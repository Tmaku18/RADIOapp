import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

export interface DiscoveryProfile {
  id: string;
  userId: string;
  displayName: string | null;
  headline: string | null;
  avatarUrl: string | null;
  bio: string | null;
  locationRegion: string | null;
  role: 'artist' | 'service_provider';
  serviceTypes: string[];
  createdAt: string;
  mentorOptIn?: boolean;
  distanceKm?: number;
  isFollowing?: boolean;
}

export interface DiscoverFeedPost {
  id: string;
  authorUserId: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  authorHeadline: string | null;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
}

@Injectable()
export class DiscoveryService {
  private deterministicSeededRank(id: string, seed: string): number {
    const input = `${seed}:${id}`;
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  async listPeople(params: {
    viewerUserId?: string;
    serviceType?: string;
    location?: string;
    search?: string;
    role?: 'artist' | 'service_provider' | 'all';
    mode?: 'default' | 'random';
    seed?: string;
    limit?: number;
    offset?: number;
    minRateCents?: number;
    maxRateCents?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }): Promise<{ items: DiscoveryProfile[]; total: number }> {
    const limit = Math.min(params.limit ?? 20, 50);
    const offset = params.offset ?? 0;
    const supabase = getSupabaseClient();
    const mode = params.mode ?? 'default';
    const seed = (params.seed ?? '').trim() || new Date().toISOString().slice(0, 10);

    // Build list of Catalyst (service provider) user_ids with their types and mentor flag
    const { data: providerRows } = await supabase
      .from('service_providers')
      .select('id, user_id, bio, location_region, mentor_opt_in');
    const providerByUserId = new Map(
      (providerRows || []).map((p: any) => [p.user_id, p]),
    );
    const providerIds = (providerRows || []).map((p: any) => p.id);

    const { data: typeRows } = await supabase
      .from('service_provider_types')
      .select('provider_id, service_type')
      .in('provider_id', providerIds);
    const typesByProviderId = new Map<string, string[]>();
    for (const t of typeRows || []) {
      const list = typesByProviderId.get(t.provider_id) ?? [];
      list.push(t.service_type);
      typesByProviderId.set(t.provider_id, list);
    }

    // Nearby: get provider user_ids and distance from PostGIS RPC
    let nearbyMap = new Map<string, number>();
    if (
      params.role === 'service_provider' &&
      params.lat != null &&
      params.lng != null &&
      params.radiusKm != null &&
      params.radiusKm > 0
    ) {
      const { data: nearby } = await supabase.rpc('get_provider_ids_nearby', {
        p_lat: params.lat,
        p_lng: params.lng,
        p_radius_km: params.radiusKm,
      });
      if (Array.isArray(nearby)) {
        nearbyMap = new Map((nearby as { user_id: string; distance_km: number }[]).map((r) => [r.user_id, r.distance_km]));
      }
    }

    // Price range: user_ids of providers that have at least one active listing in range
    const providerIdToUserId = new Map((providerRows || []).map((p: any) => [p.id, p.user_id]));
    let userIdsInPriceRange: Set<string> | null = null;
    if (
      (params.minRateCents != null || params.maxRateCents != null) &&
      providerIds.length > 0
    ) {
      const { data: listingRows } = await supabase
        .from('service_listings')
        .select('provider_id, rate_cents')
        .eq('status', 'active')
        .in('provider_id', providerIds);
      const minR = params.minRateCents ?? 0;
      const maxR = params.maxRateCents ?? Number.MAX_SAFE_INTEGER;
      const providerIdsInRange = new Set(
        (listingRows || [])
          .filter((l: any) => {
            const rate = l.rate_cents;
            if (rate == null) return false;
            return rate >= minR && rate <= maxR;
          })
          .map((l: any) => l.provider_id),
      );
      userIdsInPriceRange = new Set(
        [...providerIdsInRange].map((pid) => providerIdToUserId.get(pid)).filter(Boolean) as string[],
      );
    }

    let userQuery = supabase
      .from('users')
      .select('id, display_name, headline, avatar_url, bio, location_region, role, created_at', { count: 'exact' })
      .in('role', ['artist', 'service_provider'])
      .eq('discoverable', true)
      .eq('is_banned', false);

    if (params.role === 'artist') userQuery = userQuery.eq('role', 'artist');
    if (params.role === 'service_provider') {
      userQuery = userQuery.eq('role', 'service_provider');
      const nearbyIds = nearbyMap.size > 0 ? [...nearbyMap.keys()] : null;
      const priceIds = userIdsInPriceRange != null && userIdsInPriceRange.size > 0 ? [...userIdsInPriceRange] : null;
      if (nearbyIds && priceIds) {
        const intersection = nearbyIds.filter((id) => userIdsInPriceRange!.has(id));
        if (intersection.length > 0) userQuery = userQuery.in('id', intersection);
        else return { items: [], total: 0 };
      } else if (nearbyIds) {
        userQuery = userQuery.in('id', nearbyIds);
      } else if (priceIds) {
        userQuery = userQuery.in('id', priceIds);
      }
    }

    if (params.location?.trim()) {
      userQuery = userQuery.ilike('location_region', `%${params.location.trim()}%`);
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      userQuery = userQuery.or(`display_name.ilike.${term},headline.ilike.${term},bio.ilike.${term}`);
    }

    let usersResult:
      | { data: any[] | null; count: number | null }
      | null = null;
    if (mode === 'random') {
      const { data: users, count: totalCount } = await userQuery
        .order('created_at', { ascending: false });
      usersResult = { data: users as any[] | null, count: totalCount ?? null };
    } else {
      const { data: users, count: totalCount } = await userQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      usersResult = { data: users as any[] | null, count: totalCount ?? null };
    }
    const users = usersResult.data;
    const totalCount = usersResult.count;

    if (!users?.length) {
      return { items: [], total: totalCount ?? 0 };
    }

    let filtered = users as any[];
    if (params.serviceType?.trim()) {
      const st = params.serviceType.trim();
      filtered = filtered.filter((u) => {
        if (u.role === 'artist') return true;
        const prov = providerByUserId.get(u.id);
        if (!prov) return false;
        const types = typesByProviderId.get(prov.id) ?? [];
        return types.some((t) => t.toLowerCase() === st.toLowerCase());
      });
    }

    const followMap = new Set<string>();
    if (params.viewerUserId && filtered.length > 0) {
      const targetIds = filtered.map((u: any) => u.id);
      const { data: followRows } = await supabase
        .from('user_follows')
        .select('followed_user_id')
        .eq('follower_user_id', params.viewerUserId)
        .in('followed_user_id', targetIds);
      for (const r of followRows || []) {
        followMap.add((r as any).followed_user_id);
      }
    }

    let items: DiscoveryProfile[] = filtered.map((u) => {
      const prov = providerByUserId.get(u.id) as any;
      const providerId = prov?.id;
      const serviceTypes = providerId ? typesByProviderId.get(providerId) ?? [] : [];
      const distanceKm = nearbyMap.get(u.id);
      return {
        id: u.id,
        userId: u.id,
        displayName: u.display_name ?? null,
        headline: u.headline ?? null,
        avatarUrl: u.avatar_url ?? null,
        bio: u.bio ?? null,
        locationRegion: u.location_region ?? prov?.location_region ?? null,
        role: u.role,
        serviceTypes,
        createdAt: u.created_at,
        mentorOptIn: prov?.mentor_opt_in ?? false,
        distanceKm,
        isFollowing: followMap.has(u.id),
      };
    });

    // Sort by distance when nearby was used
    if (nearbyMap.size > 0) {
      items.sort((a, b) => {
        const da = a.distanceKm ?? Infinity;
        const db = b.distanceKm ?? Infinity;
        return da - db;
      });
    }

    if (mode === 'random') {
      items.sort(
        (a, b) =>
          this.deterministicSeededRank(a.userId, seed) -
          this.deterministicSeededRank(b.userId, seed),
      );
      items = items.slice(offset, offset + limit);
    }

    return { items, total: totalCount ?? items.length };
  }

  /**
   * List discover feed posts (endless scroll). Cursor is created_at of last item.
   */
  async listFeedPosts(params: {
    limit?: number;
    cursor?: string; // ISO date string, exclusive (posts before this)
  }): Promise<{ items: DiscoverFeedPost[]; nextCursor: string | null }> {
    const limit = Math.min(params.limit ?? 20, 50);
    const supabase = getSupabaseClient();

    let query = supabase
      .from('discover_feed_posts')
      .select(`
        id,
        author_user_id,
        image_url,
        caption,
        created_at,
        users(display_name, avatar_url, headline)
      `)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (params.cursor) {
      query = query.lt('created_at', params.cursor);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`Failed to fetch discover feed: ${error.message}`);

    const list = (rows || []) as any[];
    const hasMore = list.length > limit;
    const slice = hasMore ? list.slice(0, limit) : list;
    const nextCursor = hasMore && slice.length > 0
      ? slice[slice.length - 1].created_at
      : null;

    const items: DiscoverFeedPost[] = slice.map((r) => {
      const u = r.users;
      return {
        id: r.id,
        authorUserId: r.author_user_id,
        authorDisplayName: u?.display_name ?? null,
        authorAvatarUrl: u?.avatar_url ?? null,
        authorHeadline: u?.headline ?? null,
        imageUrl: r.image_url,
        caption: r.caption ?? null,
        createdAt: r.created_at,
      };
    });

    return { items, nextCursor };
  }

  /**
   * Create a discover feed post (catalyst only). Caller must ensure user is service_provider.
   */
  async createFeedPost(params: {
    authorUserId: string;
    imageUrl: string;
    caption?: string | null;
  }): Promise<DiscoverFeedPost> {
    const supabase = getSupabaseClient();
    const { data: row, error } = await supabase
      .from('discover_feed_posts')
      .insert({
        author_user_id: params.authorUserId,
        image_url: params.imageUrl,
        caption: params.caption ?? null,
      })
      .select(`
        id,
        author_user_id,
        image_url,
        caption,
        created_at,
        users(display_name, avatar_url, headline)
      `)
      .single();

    if (error) throw new Error(`Failed to create feed post: ${error.message}`);
    const r = row as any;
    const u = r.users;
    return {
      id: r.id,
      authorUserId: r.author_user_id,
      authorDisplayName: u?.display_name ?? null,
      authorAvatarUrl: u?.avatar_url ?? null,
      authorHeadline: u?.headline ?? null,
      imageUrl: r.image_url,
      caption: r.caption ?? null,
      createdAt: r.created_at,
    };
  }
}
