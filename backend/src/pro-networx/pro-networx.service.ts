import { Injectable, UnauthorizedException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { UpdateProProfileDto } from './dto/update-pro-profile.dto';

export type ProProfileResponse = {
  userId: string;
  availableForWork: boolean;
  skillsHeadline: string | null;
  skills: Array<{ name: string; category: string }>;
};

export type ProDirectoryItem = {
  userId: string;
  role: 'listener' | 'artist' | 'admin' | 'service_provider' | null;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  bio?: string | null;
  locationRegion: string | null;
  availableForWork: boolean;
  skillsHeadline: string | null;
  skills: string[];
  serviceTitle?: string | null;
  mediaPreviewUrl?: string | null;
  mediaPreviewType?: 'image' | 'video' | 'audio' | null;
  startingAtCents?: number | null;
  startingAtRateType?: 'hourly' | 'fixed' | null;
  verifiedCatalyst?: boolean;
  mentorOptIn?: boolean;
  updatedAt: string | null;
};

@Injectable()
export class ProNetworxService {
  async getProfileByUserId(userId: string): Promise<ProDirectoryItem & { listings?: any[]; portfolio?: any[] }> {
    const supabase = getSupabaseClient();

    // Identity
    const { data: u, error: userErr } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, headline, bio, location_region, role, is_banned, created_at')
      .eq('id', userId)
      .maybeSingle();
    if (userErr) throw new Error(`Failed to fetch user: ${userErr.message}`);
    if (!u || (u as any).is_banned) throw new UnauthorizedException('User not found');

    // Pro profile
    const { data: p } = await supabase
      .from('pro_networx.profiles')
      .select('user_id, available_for_work, skills_headline, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: skillRows } = await supabase
      .from('pro_networx.profile_skills')
      .select('skills:pro_networx.skills!inner(name)')
      .eq('user_id', userId);
    const skills = (skillRows || []).map((r: any) => r?.skills?.name).filter(Boolean) as string[];

    // Provider extension (optional)
    const { data: provider } = await supabase
      .from('service_providers')
      .select('id, hero_image_url, mentor_opt_in, instagram_url, linkedin_url, portfolio_url')
      .eq('user_id', userId)
      .maybeSingle();

    const providerId = (provider as any)?.id as string | undefined;

    const { data: listings } = providerId
      ? await supabase
          .from('service_listings')
          .select('id, service_type, title, description, rate_cents, rate_type, status, created_at, updated_at')
          .eq('provider_id', providerId)
          .order('created_at', { ascending: false })
      : { data: [] as any[] };

    const { data: portfolio } = await supabase
      .from('provider_portfolio_items')
      .select('id, type, file_url, title, description, sort_order, created_at')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    // Starting price + service title
    const activeListings = (listings || []).filter((l: any) => l.status === 'active');
    let best: any | null = null;
    for (const l of activeListings) {
      const rate = l.rate_cents as number | null;
      if (rate == null) continue;
      if (!best || rate < (best.rate_cents as number)) best = l;
    }

    const preview = (provider as any)?.hero_image_url
      ? { type: 'image' as const, url: (provider as any).hero_image_url as string }
      : (portfolio || []).length > 0
        ? { type: ((portfolio as any[])[0].type as 'image' | 'video' | 'audio') ?? 'image', url: ((portfolio as any[])[0].file_url as string) }
        : null;

    const serviceTitle =
      (best?.title?.trim() ? best.title.trim() : null)
      ?? (p?.skills_headline?.trim() ? p.skills_headline.trim() : null)
      ?? (skills[0] ?? null);

    return {
      userId,
      role: ((u as any).role as any) ?? null,
      displayName: (u as any).display_name ?? null,
      avatarUrl: (u as any).avatar_url ?? null,
      headline: (u as any).headline ?? null,
      bio: (u as any).bio ?? null,
      locationRegion: (u as any).location_region ?? null,
      availableForWork: p?.available_for_work ?? true,
      skillsHeadline: p?.skills_headline ?? null,
      skills,
      serviceTitle,
      mediaPreviewUrl: preview?.url ?? null,
      mediaPreviewType: (preview?.type as any) ?? null,
      startingAtCents: best?.rate_cents ?? null,
      startingAtRateType: best?.rate_type ?? null,
      verifiedCatalyst: (u as any).role === 'service_provider',
      mentorOptIn: (provider as any)?.mentor_opt_in ?? false,
      updatedAt: p?.updated_at ?? null,
      listings: (listings || []).map((l: any) => ({
        id: l.id,
        serviceType: l.service_type,
        title: l.title,
        description: l.description,
        rateCents: l.rate_cents ?? null,
        rateType: l.rate_type ?? 'fixed',
        status: l.status,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      })),
      portfolio: (portfolio || []).map((it: any) => ({
        id: it.id,
        type: it.type,
        fileUrl: it.file_url,
        title: it.title ?? null,
        description: it.description ?? null,
        sortOrder: it.sort_order ?? 0,
        createdAt: it.created_at,
      })),
    };
  }

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return data.id;
  }

  async getMyProfile(firebaseUid: string): Promise<ProProfileResponse> {
    const supabase = getSupabaseClient();
    const userId = await this.getUserId(firebaseUid);

    const { data: profile } = await supabase
      .from('pro_networx.profiles')
      .select('user_id, available_for_work, skills_headline')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: skillRows } = await supabase
      .from('pro_networx.profile_skills')
      .select('skill_id, skills:pro_networx.skills!inner(name, category)')
      .eq('user_id', userId);

    const skills = (skillRows || [])
      .map((r: any) => r?.skills)
      .filter(Boolean)
      .map((s: any) => ({ name: s.name as string, category: (s.category as string) ?? 'general' }));

    return {
      userId,
      availableForWork: profile?.available_for_work ?? true,
      skillsHeadline: profile?.skills_headline ?? null,
      skills,
    };
  }

  async upsertMyProfile(firebaseUid: string, dto: UpdateProProfileDto): Promise<ProProfileResponse> {
    const supabase = getSupabaseClient();
    const userId = await this.getUserId(firebaseUid);
    const now = new Date().toISOString();

    // Upsert profile core
    await supabase
      .from('pro_networx.profiles')
      .upsert(
        {
          user_id: userId,
          available_for_work: dto.availableForWork ?? true,
          skills_headline: dto.skillsHeadline ?? null,
          updated_at: now,
        },
        { onConflict: 'user_id' },
      );

    // Replace skill set if provided
    if (dto.skillNames) {
      const skillNames = dto.skillNames
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 50);

      // Ensure skills exist
      if (skillNames.length > 0) {
        await supabase
          .from('pro_networx.skills')
          .upsert(skillNames.map((name) => ({ name, category: 'general' })), { onConflict: 'name' });
      }

      // Delete old mappings
      await supabase.from('pro_networx.profile_skills').delete().eq('user_id', userId);

      // Insert new mappings
      if (skillNames.length > 0) {
        const { data: skills } = await supabase
          .from('pro_networx.skills')
          .select('id, name')
          .in('name', skillNames);

        const rows = (skills || []).map((s: any) => ({ user_id: userId, skill_id: s.id }));
        if (rows.length > 0) {
          await supabase.from('pro_networx.profile_skills').insert(rows);
        }
      }
    }

    return this.getMyProfile(firebaseUid);
  }

  async listDirectory(params: {
    skill?: string;
    availableForWork?: boolean;
    search?: string;
    location?: string;
    sort?: 'asc' | 'desc';
  }): Promise<{ items: ProDirectoryItem[]; total: number }> {
    const supabase = getSupabaseClient();
    const sort = params.sort ?? 'desc';

    // Get pro profiles
    let q = supabase
      .from('pro_networx.profiles')
      .select('user_id, available_for_work, skills_headline, updated_at', { count: 'exact' });

    if (params.availableForWork != null) {
      q = q.eq('available_for_work', params.availableForWork);
    }

    const { data: profiles, count } = await q.order('updated_at', { ascending: sort === 'asc' });
    const userIds = (profiles || []).map((p: any) => p.user_id);
    if (userIds.length === 0) return { items: [], total: 0 };

    // Load user identity fields from public.users
    let usersQ = supabase
      .from('users')
      .select('id, display_name, avatar_url, headline, bio, location_region, role, is_banned')
      .in('id', userIds)
      .eq('is_banned', false);

    if (params.location?.trim()) {
      usersQ = usersQ.ilike('location_region', `%${params.location.trim()}%`);
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      usersQ = usersQ.or(`display_name.ilike.${term},headline.ilike.${term},location_region.ilike.${term}`);
    }

    const { data: users } = await usersQ;
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    // Skills mapping: for all userIds
    const { data: skillRows } = await supabase
      .from('pro_networx.profile_skills')
      .select('user_id, skills:pro_networx.skills!inner(name)')
      .in('user_id', userIds);

    const skillsByUserId = new Map<string, string[]>();
    for (const r of skillRows || []) {
      const uid = (r as any).user_id as string;
      const name = ((r as any).skills?.name) as string | undefined;
      if (!uid || !name) continue;
      const list = skillsByUserId.get(uid) ?? [];
      list.push(name);
      skillsByUserId.set(uid, list);
    }

    const requestedSkill = params.skill?.trim().toLowerCase();

    // Provider signals (optional): hero image, mentor badge, starting price, portfolio preview
    const { data: providerRows } = await supabase
      .from('service_providers')
      .select('id, user_id, hero_image_url, mentor_opt_in')
      .in('user_id', userIds);
    const providerByUserId = new Map((providerRows || []).map((p: any) => [p.user_id, p]));
    const providerIds = (providerRows || []).map((p: any) => p.id);

    const { data: listingRows } = providerIds.length > 0
      ? await supabase
          .from('service_listings')
          .select('provider_id, title, rate_cents, rate_type, status, created_at')
          .in('provider_id', providerIds)
          .eq('status', 'active')
      : { data: [] as any[] };
    const bestListingByProviderId = new Map<string, { title: string; rateCents: number | null; rateType: 'hourly' | 'fixed' }>();
    for (const l of listingRows || []) {
      const pid = (l as any).provider_id as string;
      const rate = (l as any).rate_cents as number | null;
      const rateType = ((l as any).rate_type as 'hourly' | 'fixed') ?? 'fixed';
      const title = ((l as any).title as string) ?? '';
      const existing = bestListingByProviderId.get(pid);
      if (!existing) {
        bestListingByProviderId.set(pid, { title, rateCents: rate ?? null, rateType });
        continue;
      }
      // Prefer non-null rates; then smaller; else keep existing.
      const er = existing.rateCents;
      if (er == null && rate != null) bestListingByProviderId.set(pid, { title, rateCents: rate, rateType });
      else if (er != null && rate != null && rate < er) bestListingByProviderId.set(pid, { title, rateCents: rate, rateType });
    }

    const { data: portfolioRows } = await supabase
      .from('provider_portfolio_items')
      .select('user_id, type, file_url, sort_order, created_at')
      .in('user_id', userIds)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    const previewByUserId = new Map<string, { type: 'image' | 'video' | 'audio'; url: string }>();
    for (const p of portfolioRows || []) {
      const uid = (p as any).user_id as string;
      if (previewByUserId.has(uid)) continue;
      const type = ((p as any).type as 'image' | 'video' | 'audio') ?? 'image';
      const url = ((p as any).file_url as string) ?? '';
      if (!url) continue;
      previewByUserId.set(uid, { type, url });
    }

    const items: ProDirectoryItem[] = (profiles || [])
      .map((p: any) => {
        const u = userMap.get(p.user_id);
        if (!u) return null;
        const skills = skillsByUserId.get(p.user_id) ?? [];
        const provider = providerByUserId.get(p.user_id);
        const providerId = provider?.id as string | undefined;
        const best = providerId ? bestListingByProviderId.get(providerId) : undefined;
        const preview = previewByUserId.get(p.user_id);
        const serviceTitle =
          (best?.title?.trim() ? best.title.trim() : null)
          ?? (p.skills_headline?.trim() ? p.skills_headline.trim() : null)
          ?? (skills[0] ?? null);
        return {
          userId: p.user_id,
          role: (u.role as any) ?? null,
          displayName: u.display_name ?? null,
          avatarUrl: u.avatar_url ?? null,
          headline: u.headline ?? null,
          bio: u.bio ?? null,
          locationRegion: u.location_region ?? null,
          availableForWork: p.available_for_work ?? true,
          skillsHeadline: p.skills_headline ?? null,
          skills,
          serviceTitle,
          mediaPreviewUrl: (provider?.hero_image_url as string | null) ?? preview?.url ?? null,
          mediaPreviewType: preview?.type ?? ((provider?.hero_image_url ? 'image' : null) as any),
          startingAtCents: best?.rateCents ?? null,
          startingAtRateType: best?.rateType ?? null,
          verifiedCatalyst: (u.role === 'service_provider') || false,
          mentorOptIn: (provider?.mentor_opt_in as boolean | null) ?? false,
          updatedAt: p.updated_at ?? null,
        } as ProDirectoryItem;
      })
      .filter(Boolean) as ProDirectoryItem[];

    let filtered = requestedSkill
      ? items.filter((i) => i.skills.some((s) => s.toLowerCase() === requestedSkill))
      : items;

    // If user filtering removed some userIds, total should match visible list.
    return { items: filtered, total: filtered.length ?? count ?? 0 };
  }
}

