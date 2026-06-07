import { Injectable, UnauthorizedException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { UpdateProProfileDto } from './dto/update-pro-profile.dto';

export type ExperienceItem = {
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
};

export type EducationItem = {
  school: string;
  degree?: string;
  field?: string;
  startYear?: string;
  endYear?: string;
  description?: string;
};

export type FeaturedItem = {
  type: 'link' | 'portfolio';
  url?: string;
  title?: string;
  description?: string;
  portfolioItemId?: string;
};

export type ProProfileResponse = {
  userId: string;
  avatarUrl: string | null;
  heroImageUrl: string | null;
  availableForWork: boolean;
  skillsHeadline: string | null;
  currentTitle: string | null;
  about: string | null;
  websiteUrl: string | null;
  experience: ExperienceItem[];
  education: EducationItem[];
  featured: FeaturedItem[];
  skills: Array<{ name: string; category: string }>;
  instagramUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  soundcloudUrl: string | null;
  spotifyUrl: string | null;
  appleMusicUrl: string | null;
  facebookUrl: string | null;
  snapchatUrl: string | null;
};

export type ProDirectoryItem = {
  userId: string;
  role: 'listener' | 'artist' | 'admin' | 'service_provider' | null;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  currentTitle?: string | null;
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
  isFollowing?: boolean;
  updatedAt: string | null;
};

export type ProPublicProfileResponse = ProDirectoryItem & {
  about?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  soundcloudUrl?: string | null;
  spotifyUrl?: string | null;
  appleMusicUrl?: string | null;
  facebookUrl?: string | null;
  snapchatUrl?: string | null;
  experience?: ExperienceItem[];
  education?: EducationItem[];
  featured?: FeaturedItem[];
  listings?: any[];
  portfolio?: any[];
  /** Banner image (service_providers.hero_image_url) — used for LinkedIn-style cover. */
  heroImageUrl?: string | null;
  /** Resume PDF (mirrored from public.users.resume_url). */
  resumeUrl?: string | null;
  resumeFilename?: string | null;
};

@Injectable()
export class ProNetworxService {
  private deterministicSeededRank(id: string, seed: string): number {
    const input = `${seed}:${id}`;
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  async getProfileByUserId(userId: string): Promise<ProPublicProfileResponse> {
    const supabase = getSupabaseClient();

    // Identity
    const { data: u, error: userErr } = await supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, headline, bio, location_region, role, is_banned, created_at, website_url, instagram_url, twitter_url, youtube_url, tiktok_url, soundcloud_url, spotify_url, apple_music_url, facebook_url, snapchat_url, resume_url, resume_filename',
      )
      .eq('id', userId)
      .maybeSingle();
    if (userErr) throw new Error(`Failed to fetch user: ${userErr.message}`);
    if (!u || (u as any).is_banned)
      throw new UnauthorizedException('User not found');

    // Pro profile (including LinkedIn-style fields)
    const { data: p } = await supabase
      .schema('pro_networx')
      .from('profiles')
      .select(
        'user_id, available_for_work, skills_headline, current_title, about, website_url, experience, education, featured, updated_at',
      )
      .eq('user_id', userId)
      .maybeSingle();

    const { data: skillRows } = await supabase
      .schema('pro_networx')
      .from('profile_skills')
      .select('skills:skills!inner(name)')
      .eq('user_id', userId);
    const skills = (skillRows || [])
      .map((r: any) => r?.skills?.name)
      .filter(Boolean) as string[];

    // Provider extension (optional)
    const { data: provider } = await supabase
      .from('service_providers')
      .select(
        'id, hero_image_url, mentor_opt_in, instagram_url, linkedin_url, portfolio_url',
      )
      .eq('user_id', userId)
      .maybeSingle();

    const providerId = (provider as any)?.id as string | undefined;

    const { data: listings } = providerId
      ? await supabase
          .from('service_listings')
          .select(
            'id, service_type, title, description, rate_cents, rate_type, status, created_at, updated_at',
          )
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
    const activeListings = (listings || []).filter(
      (l: any) => l.status === 'active',
    );
    let best: any | null = null;
    for (const l of activeListings) {
      const rate = l.rate_cents as number | null;
      if (rate == null) continue;
      if (!best || rate < (best.rate_cents as number)) best = l;
    }

    const preview = (provider as any)?.hero_image_url
      ? {
          type: 'image' as const,
          url: (provider as any).hero_image_url as string,
        }
      : (portfolio || []).length > 0
        ? {
            type:
              ((portfolio as any[])[0].type as 'image' | 'video' | 'audio') ??
              'image',
            url: (portfolio as any[])[0].file_url as string,
          }
        : null;

    const serviceTitle =
      (best?.title?.trim() ? best.title.trim() : null) ??
      (p?.skills_headline?.trim() ? p.skills_headline.trim() : null) ??
      skills[0] ??
      null;

    const experience = (p as any)?.experience ?? [];
    const education = (p as any)?.education ?? [];
    const featured = (p as any)?.featured ?? [];

    return {
      userId,
      role: (u as any).role ?? null,
      displayName: (u as any).display_name ?? null,
      avatarUrl: (u as any).avatar_url ?? null,
      headline: (u as any).headline ?? null,
      currentTitle: (p as any)?.current_title ?? null,
      bio: (u as any).bio ?? null,
      about: (p as any)?.about ?? null,
      locationRegion: (u as any).location_region ?? null,
      websiteUrl:
        (u as any)?.website_url ?? (p as any)?.website_url ?? null,
      instagramUrl: (u as any)?.instagram_url ?? null,
      twitterUrl: (u as any)?.twitter_url ?? null,
      youtubeUrl: (u as any)?.youtube_url ?? null,
      tiktokUrl: (u as any)?.tiktok_url ?? null,
      soundcloudUrl: (u as any)?.soundcloud_url ?? null,
      spotifyUrl: (u as any)?.spotify_url ?? null,
      appleMusicUrl: (u as any)?.apple_music_url ?? null,
      facebookUrl: (u as any)?.facebook_url ?? null,
      snapchatUrl: (u as any)?.snapchat_url ?? null,
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
      heroImageUrl: (provider as any)?.hero_image_url ?? null,
      resumeUrl: (u as any).resume_url ?? null,
      resumeFilename: (u as any).resume_filename ?? null,
      updatedAt: p?.updated_at ?? null,
      experience: Array.isArray(experience) ? experience : [],
      education: Array.isArray(education) ? education : [],
      featured: Array.isArray(featured) ? featured : [],
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

  /**
   * Idempotent: makes sure pro_networx.profiles has a row for this user,
   * seeded from the user's radio profile fields. Migration 064 creates a
   * trigger that does this on insert + a one-time backfill, but we also call
   * this lazily so older flows (e.g. legacy users created before the trigger)
   * still get a profile.
   */
  async ensureProfileForUser(userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    try {
      await supabase
        .schema('pro_networx')
        .rpc('seed_profile_from_user', { p_user_id: userId });
    } catch {
      // Non-fatal: legacy DBs may not have the RPC yet.
    }
  }

  async getMyProfile(firebaseUid: string): Promise<ProProfileResponse> {
    const supabase = getSupabaseClient();
    const userId = await this.getUserId(firebaseUid);
    await this.ensureProfileForUser(userId);

    const { data: user } = await supabase
      .from('users')
      .select(
        'avatar_url, website_url, instagram_url, twitter_url, youtube_url, tiktok_url, soundcloud_url, spotify_url, apple_music_url, facebook_url, snapchat_url',
      )
      .eq('id', userId)
      .single();

    const { data: profile } = await supabase
      .schema('pro_networx')
      .from('profiles')
      .select(
        'user_id, available_for_work, skills_headline, current_title, about, website_url, experience, education, featured',
      )
      .eq('user_id', userId)
      .maybeSingle();

    const { data: provider } = await supabase
      .from('service_providers')
      .select('hero_image_url')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: skillRows } = await supabase
      .schema('pro_networx')
      .from('profile_skills')
      .select('skill_id, skills:skills!inner(name, category)')
      .eq('user_id', userId);

    const skills = (skillRows || [])
      .map((r: any) => r?.skills)
      .filter(Boolean)
      .map((s: any) => ({
        name: s.name as string,
        category: (s.category as string) ?? 'general',
      }));

    const experience = (profile as any)?.experience ?? [];
    const education = (profile as any)?.education ?? [];
    const featured = (profile as any)?.featured ?? [];

    return {
      userId,
      avatarUrl: (user as any)?.avatar_url ?? null,
      heroImageUrl: (provider as any)?.hero_image_url ?? null,
      availableForWork: profile?.available_for_work ?? true,
      skillsHeadline: profile?.skills_headline ?? null,
      currentTitle: (profile as any)?.current_title ?? null,
      about: (profile as any)?.about ?? null,
      websiteUrl:
        (user as any)?.website_url ?? (profile as any)?.website_url ?? null,
      experience: Array.isArray(experience) ? experience : [],
      education: Array.isArray(education) ? education : [],
      featured: Array.isArray(featured) ? featured : [],
      skills,
      instagramUrl: (user as any)?.instagram_url ?? null,
      twitterUrl: (user as any)?.twitter_url ?? null,
      youtubeUrl: (user as any)?.youtube_url ?? null,
      tiktokUrl: (user as any)?.tiktok_url ?? null,
      soundcloudUrl: (user as any)?.soundcloud_url ?? null,
      spotifyUrl: (user as any)?.spotify_url ?? null,
      appleMusicUrl: (user as any)?.apple_music_url ?? null,
      facebookUrl: (user as any)?.facebook_url ?? null,
      snapchatUrl: (user as any)?.snapchat_url ?? null,
    };
  }

  async upsertMyProfile(
    firebaseUid: string,
    dto: UpdateProProfileDto,
  ): Promise<ProProfileResponse> {
    const supabase = getSupabaseClient();
    const userId = await this.getUserId(firebaseUid);
    const now = new Date().toISOString();

    const upsertPayload: Record<string, unknown> = {
      user_id: userId,
      available_for_work: dto.availableForWork ?? true,
      skills_headline: dto.skillsHeadline ?? null,
      updated_at: now,
    };
    if (dto.currentTitle !== undefined)
      upsertPayload.current_title = dto.currentTitle?.trim() || null;
    if (dto.about !== undefined)
      upsertPayload.about = dto.about?.trim() || null;
    if (dto.websiteUrl !== undefined)
      upsertPayload.website_url = dto.websiteUrl?.trim() || null;
    if (dto.experience !== undefined) upsertPayload.experience = dto.experience;
    if (dto.education !== undefined) upsertPayload.education = dto.education;
    if (dto.featured !== undefined) upsertPayload.featured = dto.featured;

    const { error: upsertProfileError } = await supabase
      .schema('pro_networx')
      .from('profiles')
      .upsert(upsertPayload, { onConflict: 'user_id' });
    if (upsertProfileError) {
      throw new Error(
        `Failed to save profile: ${upsertProfileError.message}`,
      );
    }

    const userUpdatePayload: Record<string, unknown> = {
      updated_at: now,
    };
    if (dto.websiteUrl !== undefined)
      userUpdatePayload.website_url = dto.websiteUrl?.trim() || null;
    if (dto.instagramUrl !== undefined)
      userUpdatePayload.instagram_url = dto.instagramUrl || null;
    if (dto.twitterUrl !== undefined)
      userUpdatePayload.twitter_url = dto.twitterUrl || null;
    if (dto.youtubeUrl !== undefined)
      userUpdatePayload.youtube_url = dto.youtubeUrl || null;
    if (dto.tiktokUrl !== undefined)
      userUpdatePayload.tiktok_url = dto.tiktokUrl || null;
    if (dto.soundcloudUrl !== undefined)
      userUpdatePayload.soundcloud_url = dto.soundcloudUrl || null;
    if (dto.spotifyUrl !== undefined)
      userUpdatePayload.spotify_url = dto.spotifyUrl || null;
    if (dto.appleMusicUrl !== undefined)
      userUpdatePayload.apple_music_url = dto.appleMusicUrl || null;
    if (dto.facebookUrl !== undefined)
      userUpdatePayload.facebook_url = dto.facebookUrl || null;
    if (dto.snapchatUrl !== undefined)
      userUpdatePayload.snapchat_url = dto.snapchatUrl || null;

    if (Object.keys(userUpdatePayload).length > 1) {
      const { error: userUpdateError } = await supabase
        .from('users')
        .update(userUpdatePayload)
        .eq('id', userId);
      if (userUpdateError) {
        throw new Error(
          `Failed to update user identity: ${userUpdateError.message}`,
        );
      }
    }

    // Replace skill set if provided
    if (dto.skillNames) {
      const skillNames = dto.skillNames
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 50);

      // Ensure skills exist
      if (skillNames.length > 0) {
        const { error: skillsUpsertError } = await supabase
          .schema('pro_networx')
          .from('skills')
          .upsert(
            skillNames.map((name) => ({ name, category: 'general' })),
            { onConflict: 'name' },
          );
        if (skillsUpsertError) {
          throw new Error(
            `Failed to upsert skills: ${skillsUpsertError.message}`,
          );
        }
      }

      // Delete old mappings
      const { error: skillsDeleteError } = await supabase
        .schema('pro_networx')
        .from('profile_skills')
        .delete()
        .eq('user_id', userId);
      if (skillsDeleteError) {
        throw new Error(
          `Failed to clear existing skills: ${skillsDeleteError.message}`,
        );
      }

      // Insert new mappings
      if (skillNames.length > 0) {
        const { data: skills, error: skillsLookupError } = await supabase
          .schema('pro_networx')
          .from('skills')
          .select('id, name')
          .in('name', skillNames);
        if (skillsLookupError) {
          throw new Error(
            `Failed to look up skills: ${skillsLookupError.message}`,
          );
        }

        const rows = (skills || []).map((s: any) => ({
          user_id: userId,
          skill_id: s.id,
        }));
        if (rows.length > 0) {
          const { error: skillsInsertError } = await supabase
            .schema('pro_networx')
            .from('profile_skills')
            .insert(rows);
          if (skillsInsertError) {
            throw new Error(
              `Failed to attach skills: ${skillsInsertError.message}`,
            );
          }
        }
      }
    }

    return this.getMyProfile(firebaseUid);
  }

  async listDirectory(params: {
    viewerUserId?: string;
    skill?: string;
    availableForWork?: boolean;
    search?: string;
    location?: string;
    sort?: 'asc' | 'desc';
    mode?: 'default' | 'random' | 'smart';
    seed?: string;
  }): Promise<{ items: ProDirectoryItem[]; total: number }> {
    const supabase = getSupabaseClient();
    const sort = params.sort ?? 'desc';
    const mode = params.mode ?? 'default';
    const seed =
      (params.seed ?? '').trim() || new Date().toISOString().slice(0, 10);

    // Get pro profiles (include current_title for directory card display)
    let q = supabase
      .schema('pro_networx')
      .from('profiles')
      .select(
        'user_id, available_for_work, skills_headline, current_title, updated_at',
        { count: 'exact' },
      );

    if (params.availableForWork != null) {
      q = q.eq('available_for_work', params.availableForWork);
    }

    const { data: profiles, count } = await q.order('updated_at', {
      ascending: sort === 'asc',
    });
    const userIds = (profiles || []).map((p: any) => p.user_id);
    if (userIds.length === 0) return { items: [], total: 0 };

    // Load user identity fields from public.users
    let usersQ = supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, headline, bio, location_region, role, is_banned',
      )
      .in('id', userIds)
      // Keep users visible unless explicitly banned; legacy rows may have null.
      .or('is_banned.eq.false,is_banned.is.null');

    if (params.location?.trim()) {
      usersQ = usersQ.ilike('location_region', `%${params.location.trim()}%`);
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      usersQ = usersQ.or(
        `display_name.ilike.${term},headline.ilike.${term},location_region.ilike.${term}`,
      );
    }

    const { data: users } = await usersQ;
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    // Skills mapping: for all userIds
    const { data: skillRows } = await supabase
      .schema('pro_networx')
      .from('profile_skills')
      .select('user_id, skills:skills!inner(name)')
      .in('user_id', userIds);

    const skillsByUserId = new Map<string, string[]>();
    for (const r of skillRows || []) {
      const uid = (r as any).user_id as string;
      const name = (r as any).skills?.name as string | undefined;
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
    const providerByUserId = new Map(
      (providerRows || []).map((p: any) => [p.user_id, p]),
    );
    const providerIds = (providerRows || []).map((p: any) => p.id);

    const { data: listingRows } =
      providerIds.length > 0
        ? await supabase
            .from('service_listings')
            .select(
              'provider_id, title, rate_cents, rate_type, status, created_at',
            )
            .in('provider_id', providerIds)
            .eq('status', 'active')
        : { data: [] as any[] };
    const bestListingByProviderId = new Map<
      string,
      { title: string; rateCents: number | null; rateType: 'hourly' | 'fixed' }
    >();
    for (const l of listingRows || []) {
      const pid = l.provider_id as string;
      const rate = l.rate_cents as number | null;
      const rateType = (l.rate_type as 'hourly' | 'fixed') ?? 'fixed';
      const title = (l.title as string) ?? '';
      const existing = bestListingByProviderId.get(pid);
      if (!existing) {
        bestListingByProviderId.set(pid, {
          title,
          rateCents: rate ?? null,
          rateType,
        });
        continue;
      }
      // Prefer non-null rates; then smaller; else keep existing.
      const er = existing.rateCents;
      if (er == null && rate != null)
        bestListingByProviderId.set(pid, { title, rateCents: rate, rateType });
      else if (er != null && rate != null && rate < er)
        bestListingByProviderId.set(pid, { title, rateCents: rate, rateType });
    }

    const { data: portfolioRows } = await supabase
      .from('provider_portfolio_items')
      .select('user_id, type, file_url, sort_order, created_at')
      .in('user_id', userIds)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    const previewByUserId = new Map<
      string,
      { type: 'image' | 'video' | 'audio'; url: string }
    >();
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
        const best = providerId
          ? bestListingByProviderId.get(providerId)
          : undefined;
        const preview = previewByUserId.get(p.user_id);
        const serviceTitle =
          (best?.title?.trim() ? best.title.trim() : null) ??
          (p.skills_headline?.trim() ? p.skills_headline.trim() : null) ??
          skills[0] ??
          null;
        return {
          userId: p.user_id,
          role: u.role ?? null,
          displayName: u.display_name ?? null,
          avatarUrl: u.avatar_url ?? null,
          headline: u.headline ?? null,
          currentTitle: p.current_title ?? null,
          bio: u.bio ?? null,
          locationRegion: u.location_region ?? null,
          availableForWork: p.available_for_work ?? true,
          skillsHeadline: p.skills_headline ?? null,
          skills,
          serviceTitle,
          mediaPreviewUrl:
            (provider?.hero_image_url as string | null) ?? preview?.url ?? null,
          mediaPreviewType:
            preview?.type ??
            ((provider?.hero_image_url ? 'image' : null) as any),
          startingAtCents: best?.rateCents ?? null,
          startingAtRateType: best?.rateType ?? null,
          verifiedCatalyst: u.role === 'service_provider' || false,
          mentorOptIn: (provider?.mentor_opt_in as boolean | null) ?? false,
          updatedAt: p.updated_at ?? null,
        } as ProDirectoryItem;
      })
      .filter(Boolean) as ProDirectoryItem[];

    let filtered = requestedSkill
      ? items.filter((i) =>
          i.skills.some((s) => s.toLowerCase() === requestedSkill),
        )
      : items;

    if (params.viewerUserId && filtered.length > 0) {
      const targetIds = filtered.map((i) => i.userId);
      const { data: followRows } = await supabase
        .from('user_follows')
        .select('followed_user_id')
        .eq('follower_user_id', params.viewerUserId)
        .in('followed_user_id', targetIds);
      const followedSet = new Set(
        (followRows || []).map((r: any) => r.followed_user_id),
      );
      filtered = filtered.map((item) => ({
        ...item,
        isFollowing: followedSet.has(item.userId),
      }));
    }

    if (mode === 'random') {
      filtered.sort(
        (a, b) =>
          this.deterministicSeededRank(a.userId, seed) -
          this.deterministicSeededRank(b.userId, seed),
      );
    } else if (mode === 'smart') {
      // Music uploaded per artist (approved, publicly visible tracks).
      const { data: songRows } = await supabase
        .from('songs')
        .select('artist_id')
        .in('artist_id', userIds)
        .eq('status', 'approved');
      const musicCountByUserId = new Map<string, number>();
      for (const s of songRows || []) {
        const uid = (s as any).artist_id as string | null;
        if (!uid) continue;
        musicCountByUserId.set(uid, (musicCountByUserId.get(uid) ?? 0) + 1);
      }

      const hasServiceFor = (userId: string): boolean => {
        const providerId = providerByUserId.get(userId)?.id as
          | string
          | undefined;
        return !!(providerId && bestListingByProviderId.get(providerId));
      };

      // Count of filled profile signals -> "more completed" first.
      const completenessFor = (i: ProDirectoryItem): number => {
        let score = 0;
        if (i.avatarUrl) score += 1;
        if (i.headline || i.currentTitle || i.skillsHeadline) score += 1;
        if (i.bio) score += 1;
        if (i.skills.length > 0) score += 1;
        if (i.mediaPreviewUrl) score += 1;
        if (i.locationRegion) score += 1;
        return score;
      };

      const metaByUserId = new Map<
        string,
        { hasService: boolean; music: number; completeness: number }
      >();
      for (const i of filtered) {
        metaByUserId.set(i.userId, {
          hasService: hasServiceFor(i.userId),
          music: musicCountByUserId.get(i.userId) ?? 0,
          completeness: completenessFor(i),
        });
      }

      // Hide empty placeholder profiles: keep only those with a service,
      // uploaded music, or at least one meaningful profile field.
      filtered = filtered.filter((i) => {
        const m = metaByUserId.get(i.userId)!;
        return m.hasService || m.music > 0 || m.completeness > 0;
      });

      // Tier 1: profiles offering a service, most complete first.
      // Tier 2: everyone else (artists), most music uploaded first.
      filtered.sort((a, b) => {
        const ma = metaByUserId.get(a.userId)!;
        const mb = metaByUserId.get(b.userId)!;
        if (ma.hasService !== mb.hasService) return ma.hasService ? -1 : 1;
        if (ma.hasService) {
          if (mb.completeness !== ma.completeness)
            return mb.completeness - ma.completeness;
          if (mb.music !== ma.music) return mb.music - ma.music;
        } else {
          if (mb.music !== ma.music) return mb.music - ma.music;
          if (mb.completeness !== ma.completeness)
            return mb.completeness - ma.completeness;
        }
        // Stable, varied tie-break.
        return (
          this.deterministicSeededRank(a.userId, seed) -
          this.deterministicSeededRank(b.userId, seed)
        );
      });
    }

    // If user filtering removed some userIds, total should match visible list.
    return { items: filtered, total: filtered.length ?? count ?? 0 };
  }
}
