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
}

@Injectable()
export class DiscoveryService {
  async listPeople(params: {
    serviceType?: string;
    location?: string;
    search?: string;
    role?: 'artist' | 'service_provider' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<{ items: DiscoveryProfile[]; total: number }> {
    const limit = Math.min(params.limit ?? 20, 50);
    const offset = params.offset ?? 0;
    const supabase = getSupabaseClient();

    // Build list of service provider user_ids with their types
    const { data: providerRows } = await supabase
      .from('service_providers')
      .select('id, user_id, bio, location_region');
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

    const userIdsFromProviders = [...providerByUserId.keys()];
    let userQuery = supabase
      .from('users')
      .select('id, display_name, headline, avatar_url, bio, location_region, role, created_at', { count: 'exact' })
      .in('role', ['artist', 'service_provider'])
      .eq('is_banned', false);

    if (params.role === 'artist') userQuery = userQuery.eq('role', 'artist');
    if (params.role === 'service_provider') userQuery = userQuery.eq('role', 'service_provider');

    if (params.location?.trim()) {
      userQuery = userQuery.ilike('location_region', `%${params.location.trim()}%`);
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      userQuery = userQuery.or(`display_name.ilike.${term},headline.ilike.${term},bio.ilike.${term}`);
    }

    const { data: users, count: totalCount } = await userQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!users?.length) {
      return { items: [], total: totalCount ?? 0 };
    }

    // Filter by service type if provided: only include users who have that service type (for service_provider) or all artists
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

    const items: DiscoveryProfile[] = filtered.map((u) => {
      const prov = providerByUserId.get(u.id);
      const providerId = prov?.id;
      const serviceTypes = providerId ? typesByProviderId.get(providerId) ?? [] : [];
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
      };
    });

    return { items, total: totalCount ?? items.length };
  }
}
