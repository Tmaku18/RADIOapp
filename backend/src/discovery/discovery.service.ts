import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { isExplicitFilteredStation } from '../radio/station.constants';
import { UsersService } from '../users/users.service';

export interface DiscoveryProfile {
  id: string;
  userId: string;
  displayName: string | null;
  headline: string | null;
  avatarUrl: string | null;
  bio: string | null;
  locationRegion: string | null;
  city?: string | null;
  zipCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  role: 'artist' | 'service_provider' | 'listener';
  serviceTypes: string[];
  createdAt: string;
  mentorOptIn?: boolean;
  distanceKm?: number;
  isFollowing?: boolean;
}

export interface PeopleDirectoryGroup {
  key: string;
  label: string;
  city: string | null;
  zipCode: string | null;
  count: number;
  people: DiscoveryProfile[];
}

export interface DiscoverFeedPost {
  id: string;
  authorUserId: string;
  authorDisplayName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  authorHeadline: string | null;
  imageUrl: string;
  mediaType: 'image' | 'video';
  caption: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
}

export interface DiscoverFeedComment {
  id: string;
  postId: string;
  authorUserId: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

export interface DiscoverFeedSearchResult {
  people: Array<{
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    headline: string | null;
    role: string | null;
  }>;
  posts: DiscoverFeedPost[];
}

export interface DiscoveryMapHeatBucket {
  lat: number;
  lng: number;
  intensity: number;
  totalLikes: number;
  artistCount: number;
}

export interface DiscoveryMapCluster {
  id: string;
  lat: number;
  lng: number;
  artistCount: number;
  totalLikes: number;
  radiusKm: number;
}

export interface DiscoveryMapArtistMarker {
  artistId: string;
  displayName: string | null;
  avatarUrl: string | null;
  locationRegion: string | null;
  lat: number;
  lng: number;
  likeCount: number;
}

type MapRoleFilter = 'artist' | 'service_provider' | 'all';

@Injectable()
export class DiscoveryService {
  constructor(private readonly usersService: UsersService) {}

  private async filterBlockedPosts(
    items: DiscoverFeedPost[],
    viewerUserId?: string | null,
  ): Promise<DiscoverFeedPost[]> {
    if (!viewerUserId || items.length === 0) return items;
    const hidden = await this.usersService.getHiddenAuthorIds(viewerUserId);
    if (!hidden.size) return items;
    return items.filter((post) => !hidden.has(post.authorUserId));
  }

  private inferFeedMediaType(url: string): 'image' | 'video' {
    const normalized = url.toLowerCase();
    if (
      normalized.includes('.mp4') ||
      normalized.includes('.webm') ||
      normalized.includes('.mov')
    ) {
      return 'video';
    }
    return 'image';
  }

  private clampZoom(zoom?: number): number {
    if (zoom == null || !Number.isFinite(zoom)) return 4;
    return Math.max(1, Math.min(16, Math.round(zoom)));
  }

  private gridSizeForHeat(zoom?: number): number {
    const z = this.clampZoom(zoom);
    if (z <= 3) return 6.0;
    if (z <= 5) return 3.0;
    if (z <= 7) return 1.5;
    if (z <= 9) return 0.75;
    if (z <= 11) return 0.35;
    return 0.2;
  }

  private gridSizeForCluster(zoom?: number): number {
    const z = this.clampZoom(zoom);
    if (z <= 3) return 8.0;
    if (z <= 5) return 4.0;
    if (z <= 7) return 2.0;
    if (z <= 9) return 1.0;
    if (z <= 11) return 0.5;
    return 0.25;
  }

  private inBounds(
    lat: number,
    lng: number,
    bounds?: {
      minLat?: number;
      maxLat?: number;
      minLng?: number;
      maxLng?: number;
    },
  ): boolean {
    if (
      bounds?.minLat != null &&
      Number.isFinite(bounds.minLat) &&
      lat < bounds.minLat
    )
      return false;
    if (
      bounds?.maxLat != null &&
      Number.isFinite(bounds.maxLat) &&
      lat > bounds.maxLat
    )
      return false;
    if (
      bounds?.minLng != null &&
      Number.isFinite(bounds.minLng) &&
      lng < bounds.minLng
    )
      return false;
    if (
      bounds?.maxLng != null &&
      Number.isFinite(bounds.maxLng) &&
      lng > bounds.maxLng
    )
      return false;
    return true;
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  private haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const r = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async loadMapArtistRows(params: {
    stationId?: string;
    role?: MapRoleFilter;
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
  }): Promise<
    Array<{
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      location_region: string | null;
      role: string | null;
      artist_lat: number;
      artist_lng: number;
      like_count: number;
    }>
  > {
    const supabase = getSupabaseClient();

    let userQuery = supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, location_region, role, artist_lat, artist_lng',
      )
      .eq('discoverable', true)
      .eq('is_banned', false)
      .not('artist_lat', 'is', null)
      .not('artist_lng', 'is', null);

    if (params.role === 'artist') {
      userQuery = userQuery.eq('role', 'artist');
    } else if (params.role === 'service_provider') {
      userQuery = userQuery.eq('role', 'service_provider');
    } else {
      userQuery = userQuery.in('role', ['artist', 'service_provider']);
    }

    if (params.minLat != null)
      userQuery = userQuery.gte('artist_lat', params.minLat);
    if (params.maxLat != null)
      userQuery = userQuery.lte('artist_lat', params.maxLat);
    if (params.minLng != null)
      userQuery = userQuery.gte('artist_lng', params.minLng);
    if (params.maxLng != null)
      userQuery = userQuery.lte('artist_lng', params.maxLng);

    const { data: users, error: usersError } = await userQuery.limit(3000);
    if (usersError) {
      throw new Error(`Failed to load artist map users: ${usersError.message}`);
    }
    const userRows = (users ?? []) as Array<{
      id: string;
      display_name: string | null;
      avatar_url: string | null;
      location_region: string | null;
      role: string | null;
      artist_lat: number | null;
      artist_lng: number | null;
    }>;
    if (!userRows.length) return [];

    const artistIds = userRows.map((u) => u.id);
    let songsQuery = supabase
      .from('songs')
      .select('artist_id, like_count, station_id')
      .eq('status', 'approved')
      .in('artist_id', artistIds);
    if (params.stationId?.trim()) {
      const stationId = params.stationId.trim();
      songsQuery = songsQuery.or(
        `station_id.eq.${stationId},station_ids.cs.{${stationId}}`,
      );
      if (isExplicitFilteredStation(stationId)) {
        songsQuery = songsQuery.eq('is_explicit', false);
      }
    }
    const { data: songs, error: songsError } = await songsQuery.limit(10000);
    if (songsError) {
      throw new Error(`Failed to load map like totals: ${songsError.message}`);
    }

    const likeMap = new Map<string, number>();
    for (const row of songs ?? []) {
      const artistId = (row as any).artist_id as string | undefined;
      if (!artistId) continue;
      const likes = Number((row as any).like_count ?? 0);
      likeMap.set(
        artistId,
        (likeMap.get(artistId) ?? 0) + (Number.isFinite(likes) ? likes : 0),
      );
    }

    return userRows
      .filter(
        (u) =>
          u.artist_lat != null &&
          u.artist_lng != null &&
          Number.isFinite(u.artist_lat) &&
          Number.isFinite(u.artist_lng),
      )
      .map((u) => ({
        id: u.id,
        display_name: u.display_name ?? null,
        avatar_url: u.avatar_url ?? null,
        location_region: u.location_region ?? null,
        role: u.role ?? null,
        artist_lat: u.artist_lat as number,
        artist_lng: u.artist_lng as number,
        like_count: likeMap.get(u.id) ?? 0,
      }));
  }

  async getMapHeat(params: {
    stationId?: string;
    role?: MapRoleFilter;
    zoom?: number;
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
  }): Promise<{ buckets: DiscoveryMapHeatBucket[]; maxIntensity: number }> {
    const rows = await this.loadMapArtistRows(params);
    const grid = this.gridSizeForHeat(params.zoom);
    const buckets = new Map<
      string,
      {
        latSum: number;
        lngSum: number;
        totalLikes: number;
        artistCount: number;
      }
    >();

    for (const row of rows) {
      if (
        !this.inBounds(row.artist_lat, row.artist_lng, {
          minLat: params.minLat,
          maxLat: params.maxLat,
          minLng: params.minLng,
          maxLng: params.maxLng,
        })
      ) {
        continue;
      }
      const keyLat = Math.floor(row.artist_lat / grid);
      const keyLng = Math.floor(row.artist_lng / grid);
      const key = `${keyLat}:${keyLng}`;
      const existing = buckets.get(key) ?? {
        latSum: 0,
        lngSum: 0,
        totalLikes: 0,
        artistCount: 0,
      };
      existing.latSum += row.artist_lat;
      existing.lngSum += row.artist_lng;
      existing.artistCount += 1;
      existing.totalLikes += Math.max(0, row.like_count);
      buckets.set(key, existing);
    }

    let maxIntensity = 0;
    const out: DiscoveryMapHeatBucket[] = [];
    for (const value of buckets.values()) {
      const intensity = value.totalLikes;
      if (intensity > maxIntensity) maxIntensity = intensity;
      out.push({
        lat: value.latSum / value.artistCount,
        lng: value.lngSum / value.artistCount,
        intensity,
        totalLikes: value.totalLikes,
        artistCount: value.artistCount,
      });
    }

    return {
      buckets: out.sort((a, b) => b.intensity - a.intensity).slice(0, 600),
      maxIntensity,
    };
  }

  async getMapClusters(params: {
    stationId?: string;
    role?: MapRoleFilter;
    zoom?: number;
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
  }): Promise<{ clusters: DiscoveryMapCluster[] }> {
    const rows = await this.loadMapArtistRows(params);
    const grid = this.gridSizeForCluster(params.zoom);
    const clusters = new Map<
      string,
      {
        latSum: number;
        lngSum: number;
        totalLikes: number;
        artistCount: number;
      }
    >();

    for (const row of rows) {
      if (
        !this.inBounds(row.artist_lat, row.artist_lng, {
          minLat: params.minLat,
          maxLat: params.maxLat,
          minLng: params.minLng,
          maxLng: params.maxLng,
        })
      ) {
        continue;
      }
      const keyLat = Math.floor(row.artist_lat / grid);
      const keyLng = Math.floor(row.artist_lng / grid);
      const key = `${keyLat}:${keyLng}`;
      const existing = clusters.get(key) ?? {
        latSum: 0,
        lngSum: 0,
        totalLikes: 0,
        artistCount: 0,
      };
      existing.latSum += row.artist_lat;
      existing.lngSum += row.artist_lng;
      existing.artistCount += 1;
      existing.totalLikes += Math.max(0, row.like_count);
      clusters.set(key, existing);
    }

    const out: DiscoveryMapCluster[] = [];
    for (const [key, value] of clusters.entries()) {
      const lat = value.latSum / value.artistCount;
      const lng = value.lngSum / value.artistCount;
      out.push({
        id: key,
        lat,
        lng,
        artistCount: value.artistCount,
        totalLikes: value.totalLikes,
        radiusKm: Math.max(8, Math.round(grid * 55)),
      });
    }
    return {
      clusters: out
        .sort(
          (a, b) =>
            b.artistCount - a.artistCount || b.totalLikes - a.totalLikes,
        )
        .slice(0, 300),
    };
  }

  async getMapArtists(params: {
    stationId?: string;
    role?: MapRoleFilter;
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
    clusterLat?: number;
    clusterLng?: number;
    clusterRadiusKm?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: DiscoveryMapArtistMarker[]; total: number }> {
    const rows = await this.loadMapArtistRows(params);
    const filtered = rows.filter((row) => {
      if (
        !this.inBounds(row.artist_lat, row.artist_lng, {
          minLat: params.minLat,
          maxLat: params.maxLat,
          minLng: params.minLng,
          maxLng: params.maxLng,
        })
      ) {
        return false;
      }
      if (
        params.clusterLat != null &&
        params.clusterLng != null &&
        params.clusterRadiusKm != null &&
        Number.isFinite(params.clusterRadiusKm)
      ) {
        const distance = this.haversineKm(
          row.artist_lat,
          row.artist_lng,
          params.clusterLat,
          params.clusterLng,
        );
        if (distance > params.clusterRadiusKm) return false;
      }
      return true;
    });

    const sorted = filtered.sort(
      (a, b) =>
        b.like_count - a.like_count ||
        a.display_name?.localeCompare(b.display_name ?? '') ||
        0,
    );
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(200, Math.max(1, params.limit ?? 100));
    const paged = sorted.slice(offset, offset + limit);

    return {
      total: sorted.length,
      items: paged.map((row) => ({
        artistId: row.id,
        displayName: row.display_name ?? null,
        avatarUrl: row.avatar_url ?? null,
        locationRegion: row.location_region ?? null,
        lat: row.artist_lat,
        lng: row.artist_lng,
        likeCount: row.like_count,
      })),
    };
  }

  private deterministicSeededRank(id: string, seed: string): number {
    const input = `${seed}:${id}`;
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  /**
   * Nearby People directory: discoverable users who have set a city (and/or ZIP),
   * with map coords when geocoded. Optional GPS radius filter.
   */
  async listPeopleDirectory(params: {
    viewerUserId?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    limit?: number;
  }): Promise<{
    items: DiscoveryProfile[];
    byCity: PeopleDirectoryGroup[];
    byZip: PeopleDirectoryGroup[];
    total: number;
  }> {
    const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);
    const supabase = getSupabaseClient();

    const { data: users, error } = await supabase
      .from('users')
      .select(
        'id, display_name, headline, avatar_url, bio, location_region, city, zip_code, artist_lat, artist_lng, role, created_at',
      )
      .eq('discoverable', true)
      .eq('is_banned', false)
      .in('role', ['artist', 'service_provider', 'listener'])
      .or('city.not.is.null,zip_code.not.is.null')
      .order('city', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load people directory: ${error.message}`);
    }

    let items: DiscoveryProfile[] = (users || [])
      .filter((u: any) => {
        if (params.viewerUserId && u.id === params.viewerUserId) return false;
        const city = (u.city ?? '').toString().trim();
        const zip = (u.zip_code ?? '').toString().trim();
        return city.length > 0 || zip.length > 0;
      })
      .map((u: any) => {
        const lat =
          u.artist_lat != null && Number.isFinite(Number(u.artist_lat))
            ? Number(u.artist_lat)
            : null;
        const lng =
          u.artist_lng != null && Number.isFinite(Number(u.artist_lng))
            ? Number(u.artist_lng)
            : null;
        let distanceKm: number | undefined;
        if (
          params.lat != null &&
          params.lng != null &&
          lat != null &&
          lng != null
        ) {
          distanceKm = this.haversineKm(params.lat, params.lng, lat, lng);
        }
        return {
          id: u.id,
          userId: u.id,
          displayName: u.display_name ?? null,
          headline: u.headline ?? null,
          avatarUrl: u.avatar_url ?? null,
          bio: u.bio ?? null,
          locationRegion: u.location_region ?? null,
          city: (u.city ?? '').toString().trim() || null,
          zipCode: (u.zip_code ?? '').toString().trim() || null,
          lat,
          lng,
          role: u.role,
          serviceTypes: [] as string[],
          createdAt: u.created_at,
          distanceKm,
        };
      });

    if (
      params.lat != null &&
      params.lng != null &&
      params.radiusKm != null &&
      params.radiusKm > 0
    ) {
      items = items.filter(
        (p) => p.distanceKm != null && p.distanceKm <= params.radiusKm!,
      );
      items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    } else {
      items.sort((a, b) => {
        const ca = (a.city ?? '').toLowerCase();
        const cb = (b.city ?? '').toLowerCase();
        if (ca !== cb) return ca.localeCompare(cb);
        return (a.displayName ?? '').localeCompare(b.displayName ?? '');
      });
    }

    const byCityMap = new Map<string, DiscoveryProfile[]>();
    const byZipMap = new Map<string, DiscoveryProfile[]>();
    for (const person of items) {
      const cityKey = (person.city ?? '').trim() || 'Unknown city';
      const zipKey = (person.zipCode ?? '').trim();
      const cityList = byCityMap.get(cityKey) ?? [];
      cityList.push(person);
      byCityMap.set(cityKey, cityList);
      if (zipKey) {
        const zipList = byZipMap.get(zipKey) ?? [];
        zipList.push(person);
        byZipMap.set(zipKey, zipList);
      }
    }

    const byCity: PeopleDirectoryGroup[] = [...byCityMap.entries()]
      .map(([key, people]) => ({
        key: `city:${key}`,
        label: key,
        city: key === 'Unknown city' ? null : key,
        zipCode: null,
        count: people.length,
        people,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const byZip: PeopleDirectoryGroup[] = [...byZipMap.entries()]
      .map(([key, people]) => ({
        key: `zip:${key}`,
        label: key,
        city: people[0]?.city ?? null,
        zipCode: key,
        count: people.length,
        people,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { items, byCity, byZip, total: items.length };
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
    const seed =
      (params.seed ?? '').trim() || new Date().toISOString().slice(0, 10);

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
        nearbyMap = new Map(
          (nearby as { user_id: string; distance_km: number }[]).map((r) => [
            r.user_id,
            r.distance_km,
          ]),
        );
      }
    }

    // Price range: user_ids of providers that have at least one active listing in range
    const providerIdToUserId = new Map(
      (providerRows || []).map((p: any) => [p.id, p.user_id]),
    );
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
        [...providerIdsInRange]
          .map((pid) => providerIdToUserId.get(pid))
          .filter(Boolean) as string[],
      );
    }

    let userQuery = supabase
      .from('users')
      .select(
        'id, display_name, username, headline, avatar_url, bio, location_region, role, created_at',
        { count: 'exact' },
      )
      .in('role', ['artist', 'service_provider'])
      .eq('discoverable', true)
      .eq('is_banned', false);

    if (params.role === 'artist') userQuery = userQuery.eq('role', 'artist');
    if (params.role === 'service_provider') {
      userQuery = userQuery.eq('role', 'service_provider');
      const nearbyIds = nearbyMap.size > 0 ? [...nearbyMap.keys()] : null;
      const priceIds =
        userIdsInPriceRange != null && userIdsInPriceRange.size > 0
          ? [...userIdsInPriceRange]
          : null;
      if (nearbyIds && priceIds) {
        const intersection = nearbyIds.filter((id) =>
          userIdsInPriceRange!.has(id),
        );
        if (intersection.length > 0)
          userQuery = userQuery.in('id', intersection);
        else return { items: [], total: 0 };
      } else if (nearbyIds) {
        userQuery = userQuery.in('id', nearbyIds);
      } else if (priceIds) {
        userQuery = userQuery.in('id', priceIds);
      }
    }

    if (params.location?.trim()) {
      userQuery = userQuery.ilike(
        'location_region',
        `%${params.location.trim()}%`,
      );
    }
    if (params.search?.trim()) {
      // Escape commas/% so PostgREST or() filter stays valid for artist names.
      const raw = params.search.trim().replace(/[,()]/g, ' ');
      const term = `%${raw}%`;
      userQuery = userQuery.or(
        `display_name.ilike.${term},username.ilike.${term},headline.ilike.${term},bio.ilike.${term}`,
      );
    }

    let usersResult: { data: any[] | null; count: number | null } | null = null;
    if (mode === 'random') {
      const { data: users, count: totalCount } = await userQuery.order(
        'created_at',
        { ascending: false },
      );
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

    let filtered = users;
    if (params.viewerUserId) {
      filtered = filtered.filter((u) => u.id !== params.viewerUserId);
    }
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
      const prov = providerByUserId.get(u.id);
      const providerId = prov?.id;
      const serviceTypes = providerId
        ? (typesByProviderId.get(providerId) ?? [])
        : [];
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
   * Hydrate raw discover_feed_posts rows with author + engagement totals so
   * every surface (Pro Networks Home, Search, Networks Radio Social) returns
   * the same shape.
   */
  private async hydrateFeedPosts(
    rows: any[],
    viewerUserId?: string | null,
  ): Promise<DiscoverFeedPost[]> {
    if (!rows.length) return [];
    const supabase = getSupabaseClient();
    const postIds = rows.map((r) => r.id as string);

    const [likeAgg, commentAgg, viewerLikes, viewerBookmarks] =
      await Promise.all([
        supabase
          .from('discover_feed_post_likes')
          .select('post_id')
          .in('post_id', postIds),
        supabase
          .from('discover_feed_post_comments')
          .select('post_id, deleted_at')
          .in('post_id', postIds)
          .is('deleted_at', null),
        viewerUserId
          ? supabase
              .from('discover_feed_post_likes')
              .select('post_id')
              .eq('user_id', viewerUserId)
              .in('post_id', postIds)
          : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
        viewerUserId
          ? supabase
              .from('discover_feed_post_bookmarks')
              .select('post_id')
              .eq('user_id', viewerUserId)
              .in('post_id', postIds)
          : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
      ]);

    const likeCounts = new Map<string, number>();
    for (const row of (likeAgg.data ?? []) as Array<{ post_id: string }>) {
      likeCounts.set(row.post_id, (likeCounts.get(row.post_id) ?? 0) + 1);
    }
    const commentCounts = new Map<string, number>();
    for (const row of (commentAgg.data ?? []) as Array<{ post_id: string }>) {
      commentCounts.set(row.post_id, (commentCounts.get(row.post_id) ?? 0) + 1);
    }
    const viewerLikedSet = new Set<string>(
      ((viewerLikes.data ?? []) as Array<{ post_id: string }>).map(
        (r) => r.post_id,
      ),
    );
    const viewerBookmarkedSet = new Set<string>(
      ((viewerBookmarks.data ?? []) as Array<{ post_id: string }>).map(
        (r) => r.post_id,
      ),
    );

    return rows.map((r) => {
      const u = r.users;
      const imageUrl = r.image_url as string;
      return {
        id: r.id,
        authorUserId: r.author_user_id,
        authorDisplayName: u?.display_name ?? null,
        authorUsername: u?.username ?? null,
        authorAvatarUrl: u?.avatar_url ?? null,
        authorHeadline: u?.headline ?? null,
        imageUrl,
        mediaType: this.inferFeedMediaType(String(imageUrl ?? '')),
        caption: r.caption ?? null,
        createdAt: r.created_at,
        likeCount: likeCounts.get(r.id) ?? 0,
        commentCount: commentCounts.get(r.id) ?? 0,
        likedByMe: viewerLikedSet.has(r.id),
        bookmarkedByMe: viewerBookmarkedSet.has(r.id),
      };
    });
  }

  /**
   * List discover feed posts (endless scroll). Cursor is created_at of last item.
   * scope='following' returns only posts authored by users the viewer follows
   * (per user_follows). scope='all' returns the global feed.
   */
  async listFeedPosts(params: {
    limit?: number;
    cursor?: string; // ISO date string, exclusive (posts before this)
    viewerUserId?: string | null;
    scope?: 'all' | 'following';
  }): Promise<{ items: DiscoverFeedPost[]; nextCursor: string | null }> {
    const limit = Math.min(params.limit ?? 20, 50);
    const supabase = getSupabaseClient();

    let query = supabase
      .from('discover_feed_posts')
      .select(
        `
        id,
        author_user_id,
        image_url,
        caption,
        created_at,
        users!author_user_id(display_name, username, avatar_url, headline)
      `,
      )
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (params.cursor) {
      query = query.lt('created_at', params.cursor);
    }

    if (params.scope === 'following' && params.viewerUserId) {
      const { data: follows } = await supabase
        .from('user_follows')
        .select('followed_user_id')
        .eq('follower_user_id', params.viewerUserId);
      const followedIds = (follows ?? []).map(
        (r: any) => r.followed_user_id as string,
      );
      if (!followedIds.length) {
        return { items: [], nextCursor: null };
      }
      query = query.in('author_user_id', followedIds);
    }

    const { data: rows, error } = await query;
    if (error)
      throw new Error(`Failed to fetch discover feed: ${error.message}`);

    const list = (rows || []) as any[];
    const hasMore = list.length > limit;
    const slice = hasMore ? list.slice(0, limit) : list;
    const nextCursor =
      hasMore && slice.length > 0 ? slice[slice.length - 1].created_at : null;

    const items = await this.filterBlockedPosts(
      await this.hydrateFeedPosts(slice, params.viewerUserId ?? null),
      params.viewerUserId ?? null,
    );

    return { items, nextCursor };
  }

  /**
   * Report a discover feed post for moderation review.
   */
  async reportPost(
    viewerUserId: string,
    postId: string,
    reason: string,
  ): Promise<{ reported: true }> {
    const trimmed = reason.trim().slice(0, 2000);
    if (!trimmed) {
      throw new Error('Report reason is required');
    }
    const supabase = getSupabaseClient();
    const { data: post, error: postError } = await supabase
      .from('discover_feed_posts')
      .select('id, author_user_id')
      .eq('id', postId)
      .maybeSingle();
    if (postError || !post) {
      throw new Error('Post not found');
    }
    if (post.author_user_id === viewerUserId) {
      throw new Error('Cannot report your own post');
    }
    const { error } = await supabase.from('discover_feed_post_reports').upsert(
      {
        user_id: viewerUserId,
        post_id: postId,
        reason: trimmed,
      },
      { onConflict: 'user_id,post_id' },
    );
    if (error) {
      throw new Error(`Failed to submit report: ${error.message}`);
    }
    return { reported: true };
  }

  /**
   * List a single user's discover feed posts, newest first. Used for the
   * Instagram-style portfolio grid on Pro-Networx profiles.
   */
  async listPostsByAuthor(params: {
    authorUserId: string;
    limit?: number;
    cursor?: string;
    viewerUserId?: string | null;
  }): Promise<{ items: DiscoverFeedPost[]; nextCursor: string | null }> {
    const limit = Math.min(params.limit ?? 24, 60);
    const supabase = getSupabaseClient();

    let query = supabase
      .from('discover_feed_posts')
      .select(
        `
        id,
        author_user_id,
        image_url,
        caption,
        created_at,
        users!author_user_id(display_name, username, avatar_url, headline)
      `,
      )
      .eq('author_user_id', params.authorUserId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (params.cursor) {
      query = query.lt('created_at', params.cursor);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`Failed to fetch user posts: ${error.message}`);

    const list = (rows || []) as any[];
    const hasMore = list.length > limit;
    const slice = hasMore ? list.slice(0, limit) : list;
    const nextCursor =
      hasMore && slice.length > 0 ? slice[slice.length - 1].created_at : null;
    const items = await this.filterBlockedPosts(
      await this.hydrateFeedPosts(slice, params.viewerUserId ?? null),
      params.viewerUserId ?? null,
    );
    return { items, nextCursor };
  }

  // ---------------------------------------------------------------------------
  // Engagement: likes + comments
  // ---------------------------------------------------------------------------
  async likePost(viewerUserId: string, postId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('discover_feed_post_likes')
      .upsert(
        { post_id: postId, user_id: viewerUserId },
        { onConflict: 'post_id,user_id', ignoreDuplicates: true },
      );
    if (error) throw new Error(`Failed to like post: ${error.message}`);
  }

  async unlikePost(viewerUserId: string, postId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('discover_feed_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', viewerUserId);
    if (error) throw new Error(`Failed to unlike post: ${error.message}`);
  }

  async listComments(
    postId: string,
    limit = 50,
    before?: string,
  ): Promise<DiscoverFeedComment[]> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('discover_feed_post_comments')
      .select(
        `
          id,
          post_id,
          author_user_id,
          body,
          created_at,
          users!author_user_id(display_name, avatar_url)
        `,
      )
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load comments: ${error.message}`);
    return ((data ?? []) as any[]).map((row) => {
      const u = row.users;
      return {
        id: row.id,
        postId: row.post_id,
        authorUserId: row.author_user_id,
        authorDisplayName: u?.display_name ?? null,
        authorAvatarUrl: u?.avatar_url ?? null,
        body: row.body,
        createdAt: row.created_at,
      };
    });
  }

  async createComment(
    viewerUserId: string,
    postId: string,
    body: string,
  ): Promise<DiscoverFeedComment> {
    const supabase = getSupabaseClient();
    const trimmed = body.trim();
    if (!trimmed) {
      throw new Error('Comment body required');
    }
    const { data, error } = await supabase
      .from('discover_feed_post_comments')
      .insert({
        post_id: postId,
        author_user_id: viewerUserId,
        body: trimmed,
      })
      .select(
        `
          id,
          post_id,
          author_user_id,
          body,
          created_at,
          users!author_user_id(display_name, avatar_url)
        `,
      )
      .single();
    if (error) throw new Error(`Failed to create comment: ${error.message}`);
    const row = data as any;
    const u = row.users;
    return {
      id: row.id,
      postId: row.post_id,
      authorUserId: row.author_user_id,
      authorDisplayName: u?.display_name ?? null,
      authorAvatarUrl: u?.avatar_url ?? null,
      body: row.body,
      createdAt: row.created_at,
    };
  }

  async deleteComment(
    viewerUserId: string,
    commentId: string,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('discover_feed_post_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('author_user_id', viewerUserId);
    if (error) throw new Error(`Failed to delete comment: ${error.message}`);
  }

  // ---------------------------------------------------------------------------
  // Search + explore
  // ---------------------------------------------------------------------------
  async searchTop(
    query: string,
    viewerUserId?: string | null,
  ): Promise<DiscoverFeedSearchResult> {
    const term = query.trim();
    if (!term) return { people: [], posts: [] };
    const supabase = getSupabaseClient();
    const ilike = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

    const [peopleRes, postsRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, display_name, avatar_url, headline, role')
        .or(
          `display_name.ilike.${ilike},headline.ilike.${ilike},bio.ilike.${ilike}`,
        )
        .eq('is_banned', false)
        .eq('discoverable', true)
        .limit(10),
      supabase
        .from('discover_feed_posts')
        .select(
          `
            id,
            author_user_id,
            image_url,
            caption,
            created_at,
            users!author_user_id(display_name, username, avatar_url, headline)
          `,
        )
        .ilike('caption', ilike)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const people = ((peopleRes.data ?? []) as any[]).map((u) => ({
      userId: u.id,
      displayName: u.display_name ?? null,
      avatarUrl: u.avatar_url ?? null,
      headline: u.headline ?? null,
      role: u.role ?? null,
    }));
    const posts = await this.filterBlockedPosts(
      await this.hydrateFeedPosts(
        (postsRes.data ?? []) as any[],
        viewerUserId ?? null,
      ),
      viewerUserId ?? null,
    );

    return { people, posts };
  }

  /**
   * Default-state Search tab tile grid: a small, randomized batch of recent
   * top posts. Uses likeCount * recency as a soft "top" signal, then
   * deterministically shuffles by a daily seed so two users see different
   * orderings without hammering the DB.
   */
  async listExploreTiles(params: {
    viewerUserId?: string | null;
    limit?: number;
    seed?: string;
  }): Promise<{ items: DiscoverFeedPost[] }> {
    const limit = Math.min(params.limit ?? 60, 120);
    const supabase = getSupabaseClient();
    const sinceCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString();
    const { data, error } = await supabase
      .from('discover_feed_posts')
      .select(
        `
          id,
          author_user_id,
          image_url,
          caption,
          created_at,
          users!author_user_id(display_name, username, avatar_url, headline)
        `,
      )
      .gte('created_at', sinceCutoff)
      .order('created_at', { ascending: false })
      .limit(Math.max(limit * 3, 60));
    if (error) throw new Error(`Failed to load explore: ${error.message}`);

    const seed =
      (params.seed ?? '').trim() || new Date().toISOString().slice(0, 10);
    const ranked = ((data ?? []) as any[]).slice().sort(
      (a, b) =>
        this.deterministicSeededRank(a.id, seed) -
        this.deterministicSeededRank(b.id, seed),
    );

    const items = await this.filterBlockedPosts(
      await this.hydrateFeedPosts(
        ranked.slice(0, limit),
        params.viewerUserId ?? null,
      ),
      params.viewerUserId ?? null,
    );
    return { items };
  }

  /**
   * Endless vertical scroll on the Search tab once a user taps a tile.
   * Anchors to the tapped post on first request, then returns more random top
   * posts across users. We simulate "infinite" by paging on a randomized
   * order keyed off the seed.
   */
  async streamExplore(params: {
    viewerUserId?: string | null;
    cursor?: string | null; // base64 JSON {seed, offset}
    limit?: number;
    anchorPostId?: string | null;
  }): Promise<{
    items: DiscoverFeedPost[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(params.limit ?? 12, 30);
    let seed: string;
    let offset = 0;
    if (params.cursor) {
      try {
        const parsed = JSON.parse(
          Buffer.from(params.cursor, 'base64').toString('utf8'),
        ) as { seed?: string; offset?: number };
        seed = (parsed.seed ?? '').toString();
        offset = Math.max(0, Number(parsed.offset ?? 0));
      } catch {
        seed = new Date().toISOString();
      }
    } else {
      seed = `${Date.now()}-${Math.random()}`;
    }
    const supabase = getSupabaseClient();
    const sinceCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
      .toISOString();
    const { data, error } = await supabase
      .from('discover_feed_posts')
      .select(
        `
          id,
          author_user_id,
          image_url,
          caption,
          created_at,
          users!author_user_id(display_name, username, avatar_url, headline)
        `,
      )
      .gte('created_at', sinceCutoff)
      .order('created_at', { ascending: false })
      .limit(600);
    if (error) {
      throw new Error(`Failed to load explore stream: ${error.message}`);
    }

    let ranked = ((data ?? []) as any[]).slice().sort(
      (a, b) =>
        this.deterministicSeededRank(a.id, seed) -
        this.deterministicSeededRank(b.id, seed),
    );

    if (params.anchorPostId && offset === 0) {
      const idx = ranked.findIndex((r) => r.id === params.anchorPostId);
      if (idx > 0) {
        ranked = [
          ranked[idx],
          ...ranked.slice(0, idx),
          ...ranked.slice(idx + 1),
        ];
      }
    }

    const slice = ranked.slice(offset, offset + limit);
    const items = await this.filterBlockedPosts(
      await this.hydrateFeedPosts(slice, params.viewerUserId ?? null),
      params.viewerUserId ?? null,
    );
    const nextOffset = offset + slice.length;
    const hasMore = nextOffset < ranked.length;
    const nextCursor = hasMore
      ? Buffer.from(
          JSON.stringify({ seed, offset: nextOffset }),
          'utf8',
        ).toString('base64')
      : null;
    return { items, nextCursor };
  }

  /**
   * Create a discover feed post (catalyst only). Caller must ensure user is service_provider.
   */
  async createFeedPost(params: {
    authorUserId: string;
    imageUrl: string;
    mediaType: 'image' | 'video';
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
      .select(
        `
        id,
        author_user_id,
        image_url,
        caption,
        created_at,
        users!author_user_id(display_name, username, avatar_url, headline)
      `,
      )
      .single();

    if (error) throw new Error(`Failed to create feed post: ${error.message}`);
    const r = row as any;
    const u = r.users;
    return {
      id: r.id,
      authorUserId: r.author_user_id,
      authorDisplayName: u?.display_name ?? null,
      authorUsername: u?.username ?? null,
      authorAvatarUrl: u?.avatar_url ?? null,
      authorHeadline: u?.headline ?? null,
      imageUrl: r.image_url,
      mediaType: params.mediaType,
      caption: r.caption ?? null,
      createdAt: r.created_at,
      likeCount: 0,
      commentCount: 0,
      likedByMe: false,
      bookmarkedByMe: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Bookmarks (saved posts) + liked posts
  // ---------------------------------------------------------------------------
  async bookmarkPost(viewerUserId: string, postId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('discover_feed_post_bookmarks')
      .upsert(
        { post_id: postId, user_id: viewerUserId },
        { onConflict: 'post_id,user_id', ignoreDuplicates: true },
      );
    if (error) throw new Error(`Failed to bookmark post: ${error.message}`);
  }

  async unbookmarkPost(viewerUserId: string, postId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('discover_feed_post_bookmarks')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', viewerUserId);
    if (error) throw new Error(`Failed to remove bookmark: ${error.message}`);
  }

  /**
   * Posts the viewer has bookmarked, newest-saved first. Joins the bookmark
   * rows back to discover_feed_posts then reuses the standard hydration.
   */
  async listBookmarkedPosts(params: {
    viewerUserId: string;
    limit?: number;
    cursor?: string; // bookmark created_at, exclusive
  }): Promise<{ items: DiscoverFeedPost[]; nextCursor: string | null }> {
    const limit = Math.min(params.limit ?? 24, 60);
    const supabase = getSupabaseClient();

    let query = supabase
      .from('discover_feed_post_bookmarks')
      .select(
        `
        created_at,
        discover_feed_posts!post_id(
          id,
          author_user_id,
          image_url,
          caption,
          created_at,
          users!author_user_id(display_name, username, avatar_url, headline)
        )
      `,
      )
      .eq('user_id', params.viewerUserId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);
    if (params.cursor) query = query.lt('created_at', params.cursor);

    const { data: rows, error } = await query;
    if (error) throw new Error(`Failed to load saved posts: ${error.message}`);

    const list = (rows || []) as any[];
    const hasMore = list.length > limit;
    const slice = hasMore ? list.slice(0, limit) : list;
    const nextCursor =
      hasMore && slice.length > 0 ? slice[slice.length - 1].created_at : null;

    const postRows = slice
      .map((r) => r.discover_feed_posts)
      .filter(Boolean) as any[];
    const items = await this.filterBlockedPosts(
      await this.hydrateFeedPosts(postRows, params.viewerUserId),
      params.viewerUserId,
    );
    return { items, nextCursor };
  }

  /**
   * Posts the viewer has liked, newest-liked first.
   */
  async listLikedPosts(params: {
    viewerUserId: string;
    limit?: number;
    cursor?: string; // like created_at, exclusive
  }): Promise<{ items: DiscoverFeedPost[]; nextCursor: string | null }> {
    const limit = Math.min(params.limit ?? 24, 60);
    const supabase = getSupabaseClient();

    let query = supabase
      .from('discover_feed_post_likes')
      .select(
        `
        created_at,
        discover_feed_posts!post_id(
          id,
          author_user_id,
          image_url,
          caption,
          created_at,
          users!author_user_id(display_name, username, avatar_url, headline)
        )
      `,
      )
      .eq('user_id', params.viewerUserId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);
    if (params.cursor) query = query.lt('created_at', params.cursor);

    const { data: rows, error } = await query;
    if (error) throw new Error(`Failed to load liked posts: ${error.message}`);

    const list = (rows || []) as any[];
    const hasMore = list.length > limit;
    const slice = hasMore ? list.slice(0, limit) : list;
    const nextCursor =
      hasMore && slice.length > 0 ? slice[slice.length - 1].created_at : null;

    const postRows = slice
      .map((r) => r.discover_feed_posts)
      .filter(Boolean) as any[];
    const items = await this.filterBlockedPosts(
      await this.hydrateFeedPosts(postRows, params.viewerUserId),
      params.viewerUserId,
    );
    return { items, nextCursor };
  }

  /**
   * Lightweight single-post fetch used when sharing a post into a DM so the
   * message can carry a snapshot (image, caption, author).
   */
  async getPostSnapshot(postId: string): Promise<{
    id: string;
    authorUserId: string;
    authorDisplayName: string | null;
    authorUsername: string | null;
    authorAvatarUrl: string | null;
    imageUrl: string;
    mediaType: 'image' | 'video';
    caption: string | null;
  } | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('discover_feed_posts')
      .select(
        `
        id,
        author_user_id,
        image_url,
        caption,
        users!author_user_id(display_name, username, avatar_url)
      `,
      )
      .eq('id', postId)
      .maybeSingle();
    if (error || !data) return null;
    const r = data as any;
    const u = r.users;
    const imageUrl = r.image_url as string;
    return {
      id: r.id,
      authorUserId: r.author_user_id,
      authorDisplayName: u?.display_name ?? null,
      authorUsername: u?.username ?? null,
      authorAvatarUrl: u?.avatar_url ?? null,
      imageUrl,
      mediaType: this.inferFeedMediaType(String(imageUrl ?? '')),
      caption: r.caption ?? null,
    };
  }
}
