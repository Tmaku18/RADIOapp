import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { UpdateServiceProviderProfileDto } from './dto/update-service-provider-profile.dto';
import { CreateServiceListingDto } from './dto/create-service-listing.dto';
import { UpdateServiceListingDto } from './dto/update-service-listing.dto';
import { AddPortfolioItemDto } from './dto/add-portfolio-item.dto';

type ProviderRow = {
  id: string;
  user_id: string;
  bio: string | null;
  location_region: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class ServiceProvidersService {
  private normalizeServiceTypes(input: string[] | undefined): string[] {
    if (!input?.length) return [];
    const cleaned = input
      .map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : ''))
      .filter(Boolean)
      .slice(0, 20);
    return [...new Set(cleaned)];
  }

  private async getOrCreateProviderByUserId(userId: string): Promise<ProviderRow> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('service_providers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return existing as ProviderRow;

    const { data: inserted, error } = await supabase
      .from('service_providers')
      .insert({ user_id: userId })
      .select('*')
      .single();
    if (error) throw new Error(`Failed to create provider profile: ${error.message}`);
    return inserted as ProviderRow;
  }

  async getPublicProviderProfile(userId: string) {
    const supabase = getSupabaseClient();

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, display_name, headline, avatar_url, bio, location_region, role, created_at')
      .eq('id', userId)
      .maybeSingle();
    if (userErr) throw new Error(`Failed to fetch user: ${userErr.message}`);
    if (!user || user.role !== 'service_provider') throw new NotFoundException('Service provider not found');

    const { data: provider } = await supabase
      .from('service_providers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const providerId = (provider as any)?.id as string | undefined;

    const { data: types } = providerId
      ? await supabase
          .from('service_provider_types')
          .select('service_type')
          .eq('provider_id', providerId)
      : { data: [] as any[] };

    const { data: listings } = providerId
      ? await supabase
          .from('service_listings')
          .select('*')
          .eq('provider_id', providerId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
      : { data: [] as any[] };

    const { data: portfolio } = await supabase
      .from('provider_portfolio_items')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    const p = provider as any;
    return {
      userId: user.id,
      displayName: user.display_name ?? null,
      headline: user.headline ?? null,
      avatarUrl: user.avatar_url ?? null,
      bio: user.bio ?? p?.bio ?? null,
      locationRegion: user.location_region ?? p?.location_region ?? null,
      role: 'service_provider' as const,
      serviceTypes: (types || []).map((t: any) => t.service_type),
      heroImageUrl: p?.hero_image_url ?? null,
      instagramUrl: p?.instagram_url ?? null,
      linkedinUrl: p?.linkedin_url ?? null,
      portfolioUrl: p?.portfolio_url ?? null,
      mentorOptIn: p?.mentor_opt_in ?? false,
      listings: (listings || []).map((l: any) => ({
        id: l.id,
        serviceType: l.service_type,
        title: l.title,
        description: l.description,
        rateCents: l.rate_cents ?? null,
        rateType: l.rate_type,
        status: l.status,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      })),
      portfolio: (portfolio || []).map((p: any) => ({
        id: p.id,
        type: p.type,
        fileUrl: p.file_url,
        title: p.title,
        description: p.description,
        sortOrder: p.sort_order ?? 0,
        createdAt: p.created_at,
      })),
    };
  }

  async getMyProviderProfile(userId: string) {
    // Public profile already includes everything we need; listings filtered to active only.
    // For \"me\", we include all listings (active + paused).
    const supabase = getSupabaseClient();
    const base = await this.getPublicProviderProfile(userId);

    const provider = await this.getOrCreateProviderByUserId(userId);
    const providerId = provider.id;

    const { data: listings } = await supabase
      .from('service_listings')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });

    return {
      ...base,
      listings: (listings || []).map((l: any) => ({
        id: l.id,
        serviceType: l.service_type,
        title: l.title,
        description: l.description,
        rateCents: l.rate_cents ?? null,
        rateType: l.rate_type,
        status: l.status,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      })),
    };
  }

  async upsertMyProviderProfile(userId: string, dto: UpdateServiceProviderProfileDto) {
    const supabase = getSupabaseClient();
    const provider = await this.getOrCreateProviderByUserId(userId);

    const serviceTypes = this.normalizeServiceTypes(dto.serviceTypes);

    // Keep user profile fields aligned for discovery + public views.
    const { error: userErr } = await supabase
      .from('users')
      .update({
        bio: dto.bio ?? undefined,
        location_region: dto.locationRegion ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (userErr) throw new Error(`Failed to update user profile: ${userErr.message}`);

    const updatePayload: Record<string, unknown> = {
      bio: dto.bio ?? undefined,
      location_region: dto.locationRegion ?? undefined,
      lat: dto.lat ?? undefined,
      lng: dto.lng ?? undefined,
      updated_at: new Date().toISOString(),
    };
    if (dto.heroImageUrl !== undefined) updatePayload.hero_image_url = dto.heroImageUrl || null;
    if (dto.instagramUrl !== undefined) updatePayload.instagram_url = dto.instagramUrl || null;
    if (dto.linkedinUrl !== undefined) updatePayload.linkedin_url = dto.linkedinUrl || null;
    if (dto.portfolioUrl !== undefined) updatePayload.portfolio_url = dto.portfolioUrl || null;
    if (dto.mentorOptIn !== undefined) updatePayload.mentor_opt_in = dto.mentorOptIn;

    const { error: provErr } = await supabase
      .from('service_providers')
      .update(updatePayload)
      .eq('id', provider.id);
    if (provErr) throw new Error(`Failed to update provider profile: ${provErr.message}`);

    if (dto.serviceTypes) {
      // Reset types to exactly match the current set.
      await supabase.from('service_provider_types').delete().eq('provider_id', provider.id);
      if (serviceTypes.length > 0) {
        const { error: typeErr } = await supabase.from('service_provider_types').insert(
          serviceTypes.map((st) => ({
            provider_id: provider.id,
            service_type: st,
          })),
        );
        if (typeErr) throw new Error(`Failed to update service types: ${typeErr.message}`);
      }
    }

    return this.getMyProviderProfile(userId);
  }

  async createListing(userId: string, dto: CreateServiceListingDto) {
    const supabase = getSupabaseClient();
    const provider = await this.getOrCreateProviderByUserId(userId);

    const { data: inserted, error } = await supabase
      .from('service_listings')
      .insert({
        provider_id: provider.id,
        service_type: dto.serviceType.trim().toLowerCase(),
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        rate_cents: dto.rateCents ?? null,
        rate_type: dto.rateType ?? 'fixed',
        status: dto.status ?? 'active',
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create listing: ${error.message}`);
    return inserted;
  }

  async updateListing(userId: string, listingId: string, dto: UpdateServiceListingDto) {
    const supabase = getSupabaseClient();
    const provider = await this.getOrCreateProviderByUserId(userId);

    const { data: existing } = await supabase
      .from('service_listings')
      .select('id, provider_id')
      .eq('id', listingId)
      .maybeSingle();

    if (!existing) throw new NotFoundException('Listing not found');
    if ((existing as any).provider_id !== provider.id) throw new ForbiddenException('Not your listing');

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.serviceType !== undefined) patch.service_type = dto.serviceType.trim().toLowerCase();
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.description !== undefined) patch.description = dto.description?.trim() ?? null;
    if (dto.rateCents !== undefined) patch.rate_cents = dto.rateCents;
    if (dto.rateType !== undefined) patch.rate_type = dto.rateType;
    if (dto.status !== undefined) patch.status = dto.status;

    const { data: updated, error } = await supabase
      .from('service_listings')
      .update(patch)
      .eq('id', listingId)
      .select('*')
      .single();
    if (error) throw new Error(`Failed to update listing: ${error.message}`);
    return updated;
  }

  async deleteListing(userId: string, listingId: string) {
    const supabase = getSupabaseClient();
    const provider = await this.getOrCreateProviderByUserId(userId);

    const { data: existing } = await supabase
      .from('service_listings')
      .select('id, provider_id')
      .eq('id', listingId)
      .maybeSingle();

    if (!existing) throw new NotFoundException('Listing not found');
    if ((existing as any).provider_id !== provider.id) throw new ForbiddenException('Not your listing');

    const { error } = await supabase.from('service_listings').delete().eq('id', listingId);
    if (error) throw new Error(`Failed to delete listing: ${error.message}`);
    return { ok: true };
  }

  async addPortfolioItem(userId: string, dto: AddPortfolioItemDto) {
    const supabase = getSupabaseClient();
    // Ensure provider row exists (so discovery can still find them).
    await this.getOrCreateProviderByUserId(userId);

    const { data: inserted, error } = await supabase
      .from('provider_portfolio_items')
      .insert({
        user_id: userId,
        type: dto.type,
        file_url: dto.fileUrl.trim(),
        title: dto.title?.trim() ?? null,
        description: dto.description?.trim() ?? null,
        sort_order: dto.sortOrder ?? 0,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to add portfolio item: ${error.message}`);
    return inserted;
  }

  async deletePortfolioItem(userId: string, portfolioItemId: string) {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('provider_portfolio_items')
      .select('id, user_id')
      .eq('id', portfolioItemId)
      .maybeSingle();

    if (!existing) throw new NotFoundException('Portfolio item not found');
    if ((existing as any).user_id !== userId) throw new ForbiddenException('Not your portfolio item');

    const { error } = await supabase.from('provider_portfolio_items').delete().eq('id', portfolioItemId);
    if (error) throw new Error(`Failed to delete portfolio item: ${error.message}`);
    return { ok: true };
  }
}

