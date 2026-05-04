import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import {
  CreateProServiceListingDto,
  UpdateProServiceListingDto,
} from './dto/create-pro-service-listing.dto';

export type ProServiceListing = {
  id: string;
  ownerUserId: string;
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
  ownerHeadline: string | null;
  serviceType: string;
  title: string;
  description: string | null;
  priceCents: number | null;
  rateType: 'hourly' | 'fixed';
  currency: string;
  status: 'active' | 'paused';
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  /** Only populated when the viewer has an active Pro Networks subscription. */
  contact: {
    email: string | null;
    phone: string | null;
    link: string | null;
  } | null;
};

type ServiceRow = {
  id: string;
  provider_id: string;
  service_type: string;
  title: string;
  description: string | null;
  rate_cents: number | null;
  rate_type: 'hourly' | 'fixed';
  currency: string | null;
  status: 'active' | 'paused';
  is_published: boolean | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_link: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class ProServicesService {
  /**
   * Make sure the user has a service_providers row so we can attach a listing
   * to it. This does NOT change the user's role; non-listener users may all
   * publish listings under their existing role.
   */
  private async ensureProviderRow(userId: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('service_providers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (existing?.id) return existing.id as string;

    const { data: inserted, error } = await supabase
      .from('service_providers')
      .insert({ user_id: userId })
      .select('id')
      .single();
    if (error || !inserted) {
      throw new Error(
        `Failed to create service provider row: ${error?.message ?? 'unknown'}`,
      );
    }
    return inserted.id as string;
  }

  private mapRow(
    row: ServiceRow & {
      service_providers?: {
        user_id: string;
        users?: {
          display_name?: string | null;
          avatar_url?: string | null;
          headline?: string | null;
        };
      };
    },
    revealContact: boolean,
  ): ProServiceListing {
    const provider = row.service_providers ?? null;
    const owner = provider?.users ?? null;
    return {
      id: row.id,
      ownerUserId: provider?.user_id ?? '',
      ownerDisplayName: owner?.display_name ?? null,
      ownerAvatarUrl: owner?.avatar_url ?? null,
      ownerHeadline: owner?.headline ?? null,
      serviceType: row.service_type,
      title: row.title,
      description: row.description,
      priceCents: row.rate_cents,
      rateType: row.rate_type,
      currency: row.currency ?? 'USD',
      status: row.status,
      isPublished: row.is_published ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      contact: revealContact
        ? {
            email: row.contact_email,
            phone: row.contact_phone,
            link: row.contact_link,
          }
        : null,
    };
  }

  async list(params: {
    viewerHasSubscription: boolean;
    serviceType?: string;
    search?: string;
    minPriceCents?: number;
    maxPriceCents?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ProServiceListing[]; total: number }> {
    const supabase = getSupabaseClient();
    const limit = Math.min(params.limit ?? 20, 50);
    const offset = Math.max(0, params.offset ?? 0);

    let query = supabase
      .from('service_listings')
      .select(
        `
          id,
          provider_id,
          service_type,
          title,
          description,
          rate_cents,
          rate_type,
          currency,
          status,
          is_published,
          contact_email,
          contact_phone,
          contact_link,
          created_at,
          updated_at,
          service_providers!inner(
            user_id,
            users!inner(display_name, avatar_url, headline)
          )
        `,
        { count: 'exact' },
      )
      .eq('status', 'active')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (params.serviceType?.trim()) {
      query = query.eq('service_type', params.serviceType.trim().toLowerCase());
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      query = query.or(`title.ilike.${term},description.ilike.${term}`);
    }
    if (params.minPriceCents != null) {
      query = query.gte('rate_cents', params.minPriceCents);
    }
    if (params.maxPriceCents != null) {
      query = query.lte('rate_cents', params.maxPriceCents);
    }

    const { data, error, count } = await query.range(
      offset,
      offset + limit - 1,
    );
    if (error) {
      throw new Error(`Failed to list services: ${error.message}`);
    }

    const items = ((data ?? []) as any[]).map((row) =>
      this.mapRow(row, params.viewerHasSubscription),
    );
    return { items, total: count ?? items.length };
  }

  async getOne(
    listingId: string,
    viewerHasSubscription: boolean,
  ): Promise<ProServiceListing> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('service_listings')
      .select(
        `
          id,
          provider_id,
          service_type,
          title,
          description,
          rate_cents,
          rate_type,
          currency,
          status,
          is_published,
          contact_email,
          contact_phone,
          contact_link,
          created_at,
          updated_at,
          service_providers!inner(
            user_id,
            users!inner(display_name, avatar_url, headline)
          )
        `,
      )
      .eq('id', listingId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load service: ${error.message}`);
    if (!data) throw new NotFoundException('Service not found');
    return this.mapRow(data as any, viewerHasSubscription);
  }

  async listForUser(
    userId: string,
    viewerHasSubscription: boolean,
  ): Promise<ProServiceListing[]> {
    const supabase = getSupabaseClient();
    const { data: provider } = await supabase
      .from('service_providers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!provider) return [];
    const { data, error } = await supabase
      .from('service_listings')
      .select(
        `
          id,
          provider_id,
          service_type,
          title,
          description,
          rate_cents,
          rate_type,
          currency,
          status,
          is_published,
          contact_email,
          contact_phone,
          contact_link,
          created_at,
          updated_at,
          service_providers!inner(
            user_id,
            users!inner(display_name, avatar_url, headline)
          )
        `,
      )
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load services: ${error.message}`);
    return ((data ?? []) as any[]).map((row) =>
      this.mapRow(row, viewerHasSubscription),
    );
  }

  async listMy(userId: string): Promise<ProServiceListing[]> {
    return this.listForUser(userId, true);
  }

  async create(
    userId: string,
    dto: CreateProServiceListingDto,
  ): Promise<ProServiceListing> {
    const providerId = await this.ensureProviderRow(userId);
    const supabase = getSupabaseClient();

    const insertRow: Record<string, unknown> = {
      provider_id: providerId,
      service_type: (dto.serviceType ?? 'general').trim().toLowerCase(),
      title: dto.title.trim(),
      description: dto.description?.trim() ?? null,
      rate_cents: dto.priceCents ?? null,
      rate_type: dto.rateType ?? 'fixed',
      currency: (dto.currency ?? 'USD').toUpperCase(),
      contact_email: dto.contactEmail ?? null,
      contact_phone: dto.contactPhone ?? null,
      contact_link: dto.contactLink ?? null,
      is_published: dto.isPublished ?? true,
      status: 'active',
    };

    const { data, error } = await supabase
      .from('service_listings')
      .insert(insertRow)
      .select(
        `
          id,
          provider_id,
          service_type,
          title,
          description,
          rate_cents,
          rate_type,
          currency,
          status,
          is_published,
          contact_email,
          contact_phone,
          contact_link,
          created_at,
          updated_at,
          service_providers!inner(
            user_id,
            users!inner(display_name, avatar_url, headline)
          )
        `,
      )
      .single();
    if (error) throw new Error(`Failed to create listing: ${error.message}`);
    return this.mapRow(data as any, true);
  }

  async update(
    userId: string,
    listingId: string,
    dto: UpdateProServiceListingDto,
  ): Promise<ProServiceListing> {
    const supabase = getSupabaseClient();
    const { data: existing, error: findErr } = await supabase
      .from('service_listings')
      .select(
        'id, provider_id, service_providers!inner(user_id)',
      )
      .eq('id', listingId)
      .maybeSingle();
    if (findErr) throw new Error(`Failed to load listing: ${findErr.message}`);
    if (!existing) throw new NotFoundException('Listing not found');
    const ownerUserId = (existing as any).service_providers?.user_id as
      | string
      | undefined;
    if (!ownerUserId || ownerUserId !== userId) {
      throw new ForbiddenException('You do not own this listing');
    }

    const updateRow: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.serviceType != null)
      updateRow.service_type = dto.serviceType.trim().toLowerCase();
    if (dto.title != null) updateRow.title = dto.title.trim();
    if (dto.description !== undefined)
      updateRow.description = dto.description?.trim() ?? null;
    if (dto.priceCents !== undefined)
      updateRow.rate_cents = dto.priceCents ?? null;
    if (dto.rateType != null) updateRow.rate_type = dto.rateType;
    if (dto.currency != null)
      updateRow.currency = dto.currency.toUpperCase();
    if (dto.contactEmail !== undefined)
      updateRow.contact_email = dto.contactEmail ?? null;
    if (dto.contactPhone !== undefined)
      updateRow.contact_phone = dto.contactPhone ?? null;
    if (dto.contactLink !== undefined)
      updateRow.contact_link = dto.contactLink ?? null;
    if (dto.isPublished !== undefined)
      updateRow.is_published = dto.isPublished;

    const { data, error } = await supabase
      .from('service_listings')
      .update(updateRow)
      .eq('id', listingId)
      .select(
        `
          id,
          provider_id,
          service_type,
          title,
          description,
          rate_cents,
          rate_type,
          currency,
          status,
          is_published,
          contact_email,
          contact_phone,
          contact_link,
          created_at,
          updated_at,
          service_providers!inner(
            user_id,
            users!inner(display_name, avatar_url, headline)
          )
        `,
      )
      .single();
    if (error) throw new Error(`Failed to update listing: ${error.message}`);
    return this.mapRow(data as any, true);
  }

  async remove(userId: string, listingId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('service_listings')
      .select('id, service_providers!inner(user_id)')
      .eq('id', listingId)
      .maybeSingle();
    if (!existing) throw new NotFoundException('Listing not found');
    const ownerUserId = (existing as any).service_providers?.user_id as
      | string
      | undefined;
    if (!ownerUserId || ownerUserId !== userId) {
      throw new ForbiddenException('You do not own this listing');
    }
    const { error } = await supabase
      .from('service_listings')
      .delete()
      .eq('id', listingId);
    if (error) throw new Error(`Failed to delete listing: ${error.message}`);
  }
}
