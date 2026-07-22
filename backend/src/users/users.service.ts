import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from '../config/supabase.config';
import { signSongAudioUrl } from '../common/song-audio.util';
import { generateUniqueUsername } from '../common/username.util';
import { UploadsService } from '../uploads/uploads.service';
import { ImageModerationService } from '../moderation/image-moderation.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateArtistLikeNotificationSettingsDto } from './dto/update-artist-like-notification-settings.dto';
import { geocodeCityZip } from '../common/geocode.util';

// Transform snake_case DB response to camelCase for frontend
export interface UserResponse {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  role: 'listener' | 'artist' | 'admin' | 'service_provider';
  avatarUrl: string | null;
  createdAt: string;
  firebaseUid: string;
  region?: string | null;
  suggestLocalArtists?: boolean;
  notifyFollowedArtistOnRadio?: boolean;
  favoriteGenres?: string[];
  genreOnboardingCompletedAt?: string | null;
  bio?: string | null;
  headline?: string | null;
  locationRegion?: string | null;
  city?: string | null;
  zipCode?: string | null;
  discoverable?: boolean;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  websiteUrl?: string | null;
  soundcloudUrl?: string | null;
  spotifyUrl?: string | null;
  appleMusicUrl?: string | null;
  facebookUrl?: string | null;
  snapchatUrl?: string | null;
  artistLat?: number | null;
  artistLng?: number | null;
}

export interface FollowListItem {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  headline: string | null;
  role: 'listener' | 'artist' | 'admin' | 'service_provider' | null;
  /**
   * Relationship of this person to the profile owner being viewed:
   * - friend: mutual follow
   * - fan: follows the owner but the owner doesn't follow back
   * - following: the owner follows them but they don't follow back
   * - none: no relationship inferred
   */
  relationship?: 'friend' | 'fan' | 'following' | 'none';
}

export interface ArtistLikeNotificationSettingsResponse {
  muted: boolean;
  minLikesTrigger: number;
  cooldownMinutes: number;
}

function transformUser(data: any): UserResponse {
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    username: data.username ?? null,
    role: data.role,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
    firebaseUid: data.firebase_uid,
    region: data.region ?? null,
    suggestLocalArtists: data.suggest_local_artists ?? true,
    notifyFollowedArtistOnRadio:
      data.notify_followed_artist_on_radio ?? true,
    favoriteGenres: Array.isArray(data.favorite_genres)
      ? data.favorite_genres
      : [],
    genreOnboardingCompletedAt: data.genre_onboarding_completed_at ?? null,
    bio: data.bio ?? null,
    headline: data.headline ?? null,
    locationRegion: data.location_region ?? null,
    city: data.city ?? null,
    zipCode: data.zip_code ?? null,
    discoverable: data.discoverable ?? true,
    instagramUrl: data.instagram_url ?? null,
    twitterUrl: data.twitter_url ?? null,
    youtubeUrl: data.youtube_url ?? null,
    tiktokUrl: data.tiktok_url ?? null,
    websiteUrl: data.website_url ?? null,
    soundcloudUrl: data.soundcloud_url ?? null,
    spotifyUrl: data.spotify_url ?? null,
    appleMusicUrl: data.apple_music_url ?? null,
    facebookUrl: data.facebook_url ?? null,
    snapchatUrl: data.snapchat_url ?? null,
    artistLat: data.artist_lat ?? null,
    artistLng: data.artist_lng ?? null,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly uploadsService: UploadsService,
    private readonly configService: ConfigService,
    private readonly imageModeration: ImageModerationService,
  ) {}

  /** Admin emails from env (comma-separated); login with one of these gets role admin. */
  private readonly defaultArtistLikeNotificationSettings: ArtistLikeNotificationSettingsResponse =
    {
      muted: false,
      minLikesTrigger: 1,
      cooldownMinutes: 0,
    };

  private isMissingArtistLikeSettingsTable(error: unknown): boolean {
    const maybeError = error as { code?: string; message?: string } | null;
    const message = (maybeError?.message ?? '').toLowerCase();
    if (maybeError?.code === '42P01') {
      return (
        message.includes('artist_like_notification_settings') ||
        message.includes('public.artist_like_notification_settings')
      );
    }
    if (maybeError?.code === 'PGRST205') {
      return (
        message.includes('artist_like_notification_settings') ||
        message.includes("'public.artist_like_notification_settings'")
      );
    }
    return false;
  }

  private mapArtistLikeNotificationSettingsRow(
    row: any,
  ): ArtistLikeNotificationSettingsResponse {
    return {
      muted: row?.muted === true,
      minLikesTrigger: Math.max(1, Number(row?.min_likes_trigger ?? 1)),
      cooldownMinutes: Math.max(0, Number(row?.cooldown_minutes ?? 0)),
    };
  }

  /** Admin emails from env (comma-separated); login with one of these gets role admin. */
  private getAdminEmails(): string[] {
    const raw = this.configService.get<string>('ADMIN_EMAILS');
    if (!raw?.trim()) return [];
    return raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  /** Returns true if the given email is in the admin allowlist (for first-time login detection). */
  isAdminEmail(email: string | null | undefined): boolean {
    if (!email?.trim()) return false;
    return this.getAdminEmails().includes(email.trim().toLowerCase());
  }

  /**
   * Returns true when the current user should be treated as admin.
   * Prefers persisted DB role, with ADMIN_EMAILS as a fallback allowlist.
   */
  async isAdminUser(
    firebaseUid: string,
    email: string | null | undefined,
  ): Promise<boolean> {
    // Always honour the env allowlist first so admin login still works when the
    // DB is degraded/timing out. Otherwise the role lookup below could hang the
    // entire admin sign-in flow.
    if (this.isAdminEmail(email)) return true;
    const supabase = getSupabaseClient();
    const lookup = supabase
      .from('users')
      .select('role')
      .eq('firebase_uid', firebaseUid)
      .maybeSingle();
    try {
      const { data } = await Promise.race([
        lookup,
        new Promise<{ data: null }>((resolve) =>
          setTimeout(() => resolve({ data: null }), 4000),
        ),
      ]);
      return (data?.role ?? '').toLowerCase() === 'admin';
    } catch {
      return false;
    }
  }

  async createUser(firebaseUid: string, createUserDto: CreateUserDto) {
    const supabase = getSupabaseClient();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (existingUser) {
      // User already exists - return existing user (idempotent)
      return transformUser(existingUser);
    }

    const emailLower = createUserDto.email.trim().toLowerCase();
    const adminEmails = this.getAdminEmails();
    const requestedRole = createUserDto.role;
    const allowedSelfServeRoles = new Set([
      'listener',
      'artist',
      'service_provider',
    ]);
    // Honor signup role (listener / artist / producer). Admin emails always become admin.
    const role = adminEmails.includes(emailLower)
      ? 'admin'
      : requestedRole && allowedSelfServeRoles.has(requestedRole)
        ? requestedRole
        : 'listener';
    const displayName = createUserDto.displayName?.trim();
    if (!displayName) {
      throw new BadRequestException('Display name is required');
    }

    // username is NOT NULL/unique; auto-generate a handle for the new account.
    let data: any = null;
    let error: { code?: string; message: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const username = await generateUniqueUsername(supabase, {
        displayName,
        email: createUserDto.email,
      });
      const result = await supabase
        .from('users')
        .insert({
          firebase_uid: firebaseUid,
          email: createUserDto.email,
          display_name: displayName,
          username,
          role,
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
      if (!error) break;
      // A racing insert may have claimed the same username; on a unique
      // violation that isn't the firebase_uid/email row, regenerate and retry.
      if (error.code === '23505') {
        const { data: byUid } = await supabase
          .from('users')
          .select('*')
          .eq('firebase_uid', firebaseUid)
          .single();
        if (byUid) return transformUser(byUid);
        // Only retry for username collisions; email collisions are terminal.
        const { data: byEmail } = await supabase
          .from('users')
          .select('id')
          .eq('email', createUserDto.email)
          .maybeSingle();
        if (byEmail) break;
        continue;
      }
      break;
    }

    if (error) {
      // Race: another request created this user by firebase_uid
      if (error.code === '23505') {
        const { data: byUid } = await supabase
          .from('users')
          .select('*')
          .eq('firebase_uid', firebaseUid)
          .single();
        if (byUid) return transformUser(byUid);
        // Unique violation on email: account already exists with different auth
        const { data: byEmail } = await supabase
          .from('users')
          .select('*')
          .eq('email', createUserDto.email)
          .single();
        if (byEmail) {
          throw new BadRequestException(
            'An account with this email already exists. Try signing in with your existing method.',
          );
        }
      }
      // Check constraint (e.g. role not in allowed list)
      if (error.code === '23514') {
        throw new BadRequestException(
          `Invalid role or database constraint: ${error.message}. Please try again or contact support.`,
        );
      }
      throw new BadRequestException(
        `Failed to create account: ${error.message}. Please try again.`,
      );
    }

    // Seed credits (and producer profile) when signing up as a creative role.
    if (role === 'artist' || role === 'service_provider') {
      const { error: creditsError } = await supabase
        .from('credits')
        .insert({ artist_id: data.id, balance: 0 });
      if (creditsError && creditsError.code !== '23505') {
        console.error('Failed to create credits for new artist:', creditsError);
      }
    }
    if (role === 'service_provider') {
      const { error: providerError } = await supabase
        .from('service_providers')
        .insert({ user_id: data.id });
      if (providerError && providerError.code !== '23505') {
        console.error(
          'Failed to create service_providers row for new producer:',
          providerError,
        );
      }
    }

    return transformUser(data);
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<UserResponse> {
    const supabase = getSupabaseClient();

    // Hard timeout so a degraded Supabase doesn't hang /api/users/me for
    // minutes and starve the rest of the API.
    type Lookup = {
      data: any;
      error: { message: string } | null;
    };
    const timeoutMs = 8000;
    const lookup = (async (): Promise<Lookup> => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('firebase_uid', firebaseUid)
        .single();
      return {
        data,
        error: error ? { message: error.message } : null,
      };
    })();

    let result: Lookup;
    try {
      result = await Promise.race([
        lookup,
        new Promise<Lookup>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error(`getUserByFirebaseUid timed out after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ]);
    } catch (err) {
      throw new NotFoundException('User not found');
    }

    if (result.error || !result.data) {
      throw new NotFoundException('User not found');
    }

    return transformUser(result.data);
  }

  async getArtistLikeNotificationSettings(
    firebaseUid: string,
  ): Promise<ArtistLikeNotificationSettingsResponse> {
    const supabase = getSupabaseClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (userError || !user?.id) {
      throw new NotFoundException('User not found');
    }

    const { data, error } = await supabase
      .from('artist_like_notification_settings')
      .select('muted, min_likes_trigger, cooldown_minutes')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && !this.isMissingArtistLikeSettingsTable(error)) {
      throw new BadRequestException(
        `Failed to load artist like notification settings: ${error.message}`,
      );
    }
    if (!data || this.isMissingArtistLikeSettingsTable(error)) {
      return this.defaultArtistLikeNotificationSettings;
    }
    return this.mapArtistLikeNotificationSettingsRow(data);
  }

  async updateArtistLikeNotificationSettings(
    firebaseUid: string,
    dto: UpdateArtistLikeNotificationSettingsDto,
  ): Promise<ArtistLikeNotificationSettingsResponse> {
    const supabase = getSupabaseClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (userError || !user?.id) {
      throw new NotFoundException('User not found');
    }

    const current = await this.getArtistLikeNotificationSettings(firebaseUid);
    const next: ArtistLikeNotificationSettingsResponse = {
      muted: dto.muted ?? current.muted,
      minLikesTrigger: dto.minLikesTrigger ?? current.minLikesTrigger,
      cooldownMinutes: dto.cooldownMinutes ?? current.cooldownMinutes,
    };

    const { data, error } = await supabase
      .from('artist_like_notification_settings')
      .upsert(
        {
          user_id: user.id,
          muted: next.muted,
          min_likes_trigger: next.minLikesTrigger,
          cooldown_minutes: next.cooldownMinutes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('muted, min_likes_trigger, cooldown_minutes')
      .single();

    if (error) {
      if (this.isMissingArtistLikeSettingsTable(error)) {
        return next;
      }
      throw new BadRequestException(
        `Failed to save artist like notification settings: ${error.message}`,
      );
    }
    return this.mapArtistLikeNotificationSettingsRow(data);
  }

  async getDbUserIdByFirebaseUid(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data?.id) {
      throw new NotFoundException('User not found');
    }
    return data.id;
  }

  private async resolveUserId(identifier: string): Promise<string> {
    const supabase = getSupabaseClient();
    const normalized = (identifier || '').trim();
    if (!normalized) throw new NotFoundException('User not found');

    const { data: byId } = await supabase
      .from('users')
      .select('id')
      .eq('id', normalized)
      .maybeSingle();
    if (byId?.id) return byId.id;

    const { data: byFirebaseUid } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', normalized)
      .maybeSingle();
    if (byFirebaseUid?.id) return byFirebaseUid.id;

    const { data: byProviderId } = await supabase
      .from('service_providers')
      .select('user_id')
      .eq('id', normalized)
      .maybeSingle();
    if ((byProviderId as { user_id?: string } | null)?.user_id) {
      return (byProviderId as { user_id: string }).user_id;
    }

    throw new NotFoundException('User not found');
  }

  private isMissingUserFollowsTable(error: unknown): boolean {
    const maybeError = error as { code?: string; message?: string } | null;
    const message = (maybeError?.message ?? '').toLowerCase();
    if (maybeError?.code === '42P01') {
      return (
        message.includes('user_follows') ||
        message.includes('public.user_follows')
      );
    }
    // PostgREST schema cache miss format:
    // "Could not find the table 'public.user_follows' in the schema cache"
    if (maybeError?.code === 'PGRST205') {
      return (
        message.includes("'public.user_follows'") ||
        message.includes("'user_follows'") ||
        message.includes('user_follows')
      );
    }
    return false;
  }

  private isMissingSongFeaturedArtistsTable(error: unknown): boolean {
    const maybeError = error as { code?: string; message?: string } | null;
    const message = (maybeError?.message ?? '').toLowerCase();
    if (maybeError?.code === '42P01') {
      return (
        message.includes('song_featured_artists') ||
        message.includes('public.song_featured_artists')
      );
    }
    if (maybeError?.code === 'PGRST205') {
      return (
        message.includes("'public.song_featured_artists'") ||
        message.includes("'song_featured_artists'") ||
        message.includes('song_featured_artists')
      );
    }
    return false;
  }

  private isMissingSongsProfilePlayCountColumn(error: unknown): boolean {
    const maybeError = error as { code?: string; message?: string } | null;
    const message = (maybeError?.message ?? '').toLowerCase();
    return (
      maybeError?.code === '42703' ||
      message.includes('songs.profile_play_count') ||
      message.includes('column songs.profile_play_count does not exist') ||
      message.includes('profile_play_count')
    );
  }

  private isMissingSongProfileListensTable(error: unknown): boolean {
    const maybeError = error as { code?: string; message?: string } | null;
    const message = (maybeError?.message ?? '').toLowerCase();
    if (maybeError?.code === '42P01') {
      return (
        message.includes('song_profile_listens') ||
        message.includes('public.song_profile_listens')
      );
    }
    if (maybeError?.code === 'PGRST205') {
      return (
        message.includes('song_profile_listens') ||
        message.includes("'public.song_profile_listens'")
      );
    }
    return false;
  }

  async getUserById(userId: string): Promise<UserResponse> {
    const supabase = getSupabaseClient();
    const resolvedUserId = await this.resolveUserId(userId);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', resolvedUserId)
      .single();

    if (error || !data) {
      throw new NotFoundException('User not found');
    }

    return transformUser(data);
  }

  async updateUser(
    firebaseUid: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponse> {
    const supabase = getSupabaseClient();

    const { data: user } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updateUserDto.displayName !== undefined) {
      const trimmedDisplayName = updateUserDto.displayName.trim();
      if (!trimmedDisplayName) {
        throw new BadRequestException('Display name cannot be empty');
      }
      updatePayload.display_name = trimmedDisplayName;
    }
    if (updateUserDto.username !== undefined) {
      const normalized = this.normalizeUsername(updateUserDto.username);
      const available = await this.isUsernameAvailable(normalized, user.id);
      if (!available) {
        throw new ConflictException('That username is already taken.');
      }
      updatePayload.username = normalized;
    }
    if (updateUserDto.avatarUrl !== undefined) {
      // Avatar set by URL bypasses the multipart upload screen, so scan here.
      if (updateUserDto.avatarUrl?.trim()) {
        await this.imageModeration.assertImageUrlAllowed(
          updateUserDto.avatarUrl.trim(),
          'Profile picture',
        );
      }
      updatePayload.avatar_url = updateUserDto.avatarUrl;
    }
    if (updateUserDto.region !== undefined)
      updatePayload.region = updateUserDto.region;
    if (updateUserDto.suggestLocalArtists !== undefined)
      updatePayload.suggest_local_artists = updateUserDto.suggestLocalArtists;
    if (updateUserDto.notifyFollowedArtistOnRadio !== undefined)
      updatePayload.notify_followed_artist_on_radio =
        updateUserDto.notifyFollowedArtistOnRadio;
    if (updateUserDto.favoriteGenres !== undefined) {
      const normalized = [
        ...new Set(
          updateUserDto.favoriteGenres
            .map((g) => g.trim().toLowerCase())
            .filter(Boolean),
        ),
      ];
      updatePayload.favorite_genres = normalized;
    }
    if (updateUserDto.completeGenreOnboarding === true) {
      updatePayload.genre_onboarding_completed_at = new Date().toISOString();
    }
    if (updateUserDto.bio !== undefined) updatePayload.bio = updateUserDto.bio;
    if (updateUserDto.headline !== undefined)
      updatePayload.headline = updateUserDto.headline;
    if (updateUserDto.locationRegion !== undefined)
      updatePayload.location_region = updateUserDto.locationRegion;

    const cityProvided = updateUserDto.city !== undefined;
    const zipProvided = updateUserDto.zipCode !== undefined;
    if (cityProvided) {
      const city = updateUserDto.city?.trim() || null;
      updatePayload.city = city;
    }
    if (zipProvided) {
      const zip = updateUserDto.zipCode?.trim() || null;
      updatePayload.zip_code = zip;
    }

    // Keep location_region in sync when city/zip change (unless caller set it).
    if (
      (cityProvided || zipProvided) &&
      updateUserDto.locationRegion === undefined
    ) {
      const nextCity = cityProvided
        ? (updateUserDto.city?.trim() || '')
        : undefined;
      const nextZip = zipProvided
        ? (updateUserDto.zipCode?.trim() || '')
        : undefined;
      // Need current values when only one field is patched.
      if (nextCity === undefined || nextZip === undefined) {
        const { data: current } = await supabase
          .from('users')
          .select('city, zip_code')
          .eq('id', user.id)
          .maybeSingle();
        const city =
          nextCity !== undefined
            ? nextCity
            : ((current?.city as string | null) ?? '');
        const zip =
          nextZip !== undefined
            ? nextZip
            : ((current?.zip_code as string | null) ?? '');
        updatePayload.location_region = [city, zip]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(', ') || null;
      } else {
        updatePayload.location_region = [nextCity, nextZip]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(', ') || null;
      }
    }

    // Geocode city/ZIP → map pin when city (or zip) changes and coords not explicit.
    if (
      (cityProvided || zipProvided) &&
      updateUserDto.artistLat === undefined &&
      updateUserDto.artistLng === undefined
    ) {
      const { data: currentLoc } = await supabase
        .from('users')
        .select('city, zip_code')
        .eq('id', user.id)
        .maybeSingle();
      const city =
        (cityProvided
          ? updateUserDto.city?.trim()
          : (currentLoc?.city as string | null)?.trim()) || '';
      const zip =
        (zipProvided
          ? updateUserDto.zipCode?.trim()
          : (currentLoc?.zip_code as string | null)?.trim()) || '';
      if (city || zip) {
        // City centroid only (ZIP alone is a fallback). Exact GPS is never stored here.
        const geo = await geocodeCityZip(city, zip);
        if (geo) {
          updatePayload.artist_lat = geo.lat;
          updatePayload.artist_lng = geo.lng;
        }
      } else {
        updatePayload.artist_lat = null;
        updatePayload.artist_lng = null;
      }
    }

    if (updateUserDto.discoverable !== undefined)
      updatePayload.discoverable = updateUserDto.discoverable;
    if (updateUserDto.instagramUrl !== undefined)
      updatePayload.instagram_url = updateUserDto.instagramUrl || null;
    if (updateUserDto.twitterUrl !== undefined)
      updatePayload.twitter_url = updateUserDto.twitterUrl || null;
    if (updateUserDto.youtubeUrl !== undefined)
      updatePayload.youtube_url = updateUserDto.youtubeUrl || null;
    if (updateUserDto.tiktokUrl !== undefined)
      updatePayload.tiktok_url = updateUserDto.tiktokUrl || null;
    if (updateUserDto.websiteUrl !== undefined)
      updatePayload.website_url = updateUserDto.websiteUrl || null;
    if (updateUserDto.soundcloudUrl !== undefined)
      updatePayload.soundcloud_url = updateUserDto.soundcloudUrl || null;
    if (updateUserDto.spotifyUrl !== undefined)
      updatePayload.spotify_url = updateUserDto.spotifyUrl || null;
    if (updateUserDto.appleMusicUrl !== undefined)
      updatePayload.apple_music_url = updateUserDto.appleMusicUrl || null;
    if (updateUserDto.facebookUrl !== undefined)
      updatePayload.facebook_url = updateUserDto.facebookUrl || null;
    if (updateUserDto.snapchatUrl !== undefined)
      updatePayload.snapchat_url = updateUserDto.snapchatUrl || null;
    if (updateUserDto.artistLat !== undefined)
      updatePayload.artist_lat = updateUserDto.artistLat;
    if (updateUserDto.artistLng !== undefined)
      updatePayload.artist_lng = updateUserDto.artistLng;
    if (updateUserDto.role !== undefined) {
      if (user.role === 'admin') {
        throw new BadRequestException(
          'Admin users cannot change account type here.',
        );
      }
      if (
        updateUserDto.role !== 'listener' &&
        updateUserDto.role !== 'artist' &&
        updateUserDto.role !== 'service_provider'
      ) {
        throw new BadRequestException(
          'Role must be listener, artist, or service_provider.',
        );
      }
      updatePayload.role = updateUserDto.role;
      if (
        (updateUserDto.role === 'artist' ||
          updateUserDto.role === 'service_provider') &&
        user.role !== updateUserDto.role
      ) {
        const { error: creditsError } = await supabase
          .from('credits')
          .insert({ artist_id: user.id, balance: 0 });
        if (creditsError && creditsError.code !== '23505') {
          console.error(
            'Failed to create credits for new artist:',
            creditsError,
          );
        }
      }
      if (
        updateUserDto.role === 'service_provider' &&
        user.role !== 'service_provider'
      ) {
        const { error: providerError } = await supabase
          .from('service_providers')
          .insert({ user_id: user.id });
        if (providerError && providerError.code !== '23505') {
          console.error(
            'Failed to create service_providers row during role switch:',
            providerError,
          );
        }
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException('That username is already taken.');
      }
      throw new BadRequestException(`Failed to update user: ${error.message}`);
    }

    return transformUser(data);
  }

  /**
   * Normalize and validate a requested username. Lowercases, trims, and
   * enforces the same 3-30 char [a-z0-9_.] rule as the DB constraint.
   */
  normalizeUsername(raw: string): string {
    const normalized = (raw ?? '').trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(normalized)) {
      throw new BadRequestException(
        'Username must be 3-30 characters using lowercase letters, numbers, underscores, or dots.',
      );
    }
    return normalized;
  }

  /**
   * Returns true if the username is free (case-insensitive). When excludeUserId
   * is provided, the caller's own current username does not count as taken.
   */
  async isUsernameAvailable(
    username: string,
    excludeUserId?: string,
  ): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') {
      // Treat a missing column/table as "available" so degraded envs don't block.
      if (this.isMissingUsernameColumn(error)) return true;
      throw new BadRequestException(
        `Failed to check username: ${error.message}`,
      );
    }
    if (!data) return true;
    return excludeUserId ? data.id === excludeUserId : false;
  }

  /** Availability check for the authenticated user (excludes their own handle). */
  async checkUsernameAvailable(
    firebaseUid: string,
    rawUsername: string,
  ): Promise<{ available: boolean; username: string }> {
    const username = this.normalizeUsername(rawUsername);
    const userId = await this.getDbUserIdByFirebaseUid(firebaseUid).catch(
      () => undefined,
    );
    const available = await this.isUsernameAvailable(username, userId);
    return { available, username };
  }

  async getUserByUsername(rawUsername: string): Promise<UserResponse> {
    const supabase = getSupabaseClient();
    const username = (rawUsername ?? '').trim().toLowerCase();
    if (!username) throw new NotFoundException('User not found');
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    if (error || !data) {
      throw new NotFoundException('User not found');
    }
    return transformUser(data);
  }

  private isMissingUsernameColumn(error: unknown): boolean {
    const maybeError = error as { code?: string; message?: string } | null;
    const message = (maybeError?.message ?? '').toLowerCase();
    return (
      maybeError?.code === '42703' ||
      maybeError?.code === 'PGRST204' ||
      message.includes('users.username') ||
      message.includes("column users.username") ||
      message.includes("'username'")
    );
  }

  /**
   * Upload a profile picture and set it as the user's avatar.
   * Accepts JPEG, PNG, WebP up to 15MB.
   */
  async updateAvatar(
    firebaseUid: string,
    file: Express.Multer.File,
  ): Promise<UserResponse> {
    const supabase = getSupabaseClient();
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (fetchError || !user) {
      throw new NotFoundException('User not found');
    }

    const avatarUrl = await this.uploadsService.uploadProfileImage(
      file,
      user.id,
    );

    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestException(
        `Failed to update avatar: ${updateError.message}`,
      );
    }

    return transformUser(updated);
  }

  async upgradeToArtist(firebaseUid: string): Promise<UserResponse> {
    const supabase = getSupabaseClient();

    // Get current user
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (fetchError || !user) {
      throw new NotFoundException('User not found');
    }

    // No-op if already artist (single user type: everyone is artist by default)
    if (user.role === 'artist' || user.role === 'service_provider') {
      return transformUser(user);
    }
    if (user.role === 'admin') {
      throw new BadRequestException('Admin users cannot be upgraded to artist');
    }

    // Update role to artist (legacy listener upgrade path)
    const { data, error: updateError } = await supabase
      .from('users')
      .update({
        role: 'artist',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestException(`Failed to upgrade user: ${updateError.message}`);
    }

    // Initialize credits record for new artist
    const { error: creditsError } = await supabase.from('credits').insert({
      artist_id: user.id,
      balance: 0,
    });

    // If credits record already exists (shouldn't happen), that's fine
    if (creditsError && creditsError.code !== '23505') {
      console.error('Failed to create credits record:', creditsError);
    }

    return transformUser(data);
  }

  /**
   * Upgrade current user to Catalyst (service provider) for ProNetworx.
   * Creates service_providers row (separate from radio profile); user keeps same id.
   */
  async upgradeToCatalyst(firebaseUid: string): Promise<UserResponse> {
    const supabase = getSupabaseClient();

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (fetchError || !user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'service_provider') {
      throw new BadRequestException('You are already a Producer');
    }
    if (user.role === 'admin') {
      throw new BadRequestException(
        'Admin users cannot be upgraded to Producer',
      );
    }

    const { data, error: updateError } = await supabase
      .from('users')
      .update({
        role: 'service_provider',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestException(
        `Failed to upgrade: ${updateError.message}`,
      );
    }

    const { error: creditsError } = await supabase.from('credits').insert({
      artist_id: user.id,
      balance: 0,
    });
    if (creditsError && creditsError.code !== '23505') {
      console.error('Failed to create credits for Catalyst:', creditsError);
    }

    const { error: providerError } = await supabase
      .from('service_providers')
      .insert({ user_id: user.id });
    if (providerError && providerError.code !== '23505') {
      console.error('Failed to create service_providers row:', providerError);
    }

    return transformUser(data);
  }

  /**
   * Spotify-style artist profile aggregate used by public and dashboard artist pages.
   * Includes artist metadata, social links, summary stats, popular tracks, and full library.
   */
  async getArtistProfile(userId: string, viewerUserId?: string | null) {
    const supabase = getSupabaseClient();
    const resolvedUserId = await this.resolveUserId(userId);
    // Use select('*') for backward compatibility when some envs lag migrations.
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', resolvedUserId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('Artist not found');
    }

    const requestingOwnProfile =
      !!viewerUserId && viewerUserId === resolvedUserId;
    const songsBaseFields = [
      'id',
      'title',
      'artist_id',
      'artist_name',
      'audio_url',
      'artwork_url',
      'duration_seconds',
      'play_count',
      'profile_play_count',
      'like_count',
      'created_at',
      'status',
      'sample_url',
      'sample_start_seconds',
      'sample_end_seconds',
      'price_cents',
      'is_for_sale',
    ];
    let songsQuery = supabase
      .from('songs')
      .select(songsBaseFields.join(','))
      .eq('artist_id', resolvedUserId)
      .order('created_at', { ascending: false });
    if (!requestingOwnProfile) {
      songsQuery = songsQuery.eq('status', 'approved');
    }
    const { data: songs, error: songsError } = await songsQuery;
    let songRows = (songs ?? []) as any[];
    if (songsError) {
      if (!this.isMissingSongsProfilePlayCountColumn(songsError)) {
        throw new BadRequestException(
          `Failed to load artist songs: ${songsError.message}`,
        );
      }

      // Compatibility fallback for envs that have not added songs.profile_play_count yet.
      let fallbackSongsQuery = supabase
        .from('songs')
        .select(
          songsBaseFields
            .filter((field) => field !== 'profile_play_count')
            .join(','),
        )
        .eq('artist_id', resolvedUserId)
        .order('created_at', { ascending: false });
      if (!requestingOwnProfile) {
        fallbackSongsQuery = fallbackSongsQuery.eq('status', 'approved');
      }
      const { data: fallbackSongs, error: fallbackSongsError } =
        await fallbackSongsQuery;
      if (fallbackSongsError) {
        throw new BadRequestException(
          `Failed to load artist songs: ${fallbackSongsError.message}`,
        );
      }
      songRows = (fallbackSongs ?? []).map((row: any) => ({
        ...row,
        profile_play_count: 0,
      }));
    }
    const songIds = songRows.map((song) => song.id as string);
    const featuredBySongId = new Map<
      string,
      Array<{
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
      }>
    >();
    if (songIds.length > 0) {
      const { data: featuredRows, error: featuredRowsError } = await supabase
        .from('song_featured_artists')
        .select('song_id, featured_user_id')
        .in('song_id', songIds);
      if (
        featuredRowsError &&
        !this.isMissingSongFeaturedArtistsTable(featuredRowsError)
      ) {
        throw new BadRequestException(
          `Failed to load featured artists: ${featuredRowsError.message}`,
        );
      }
      if (
        !featuredRowsError &&
        Array.isArray(featuredRows) &&
        featuredRows.length > 0
      ) {
        const featuredUserIds = [
          ...new Set(
            featuredRows.map((row: any) => row.featured_user_id as string),
          ),
        ];
        const { data: featuredUsers, error: featuredUsersError } =
          await supabase
            .from('users')
            .select('id, display_name, avatar_url')
            .in('id', featuredUserIds);
        if (featuredUsersError) {
          throw new BadRequestException(
            `Failed to load featured artist profiles: ${featuredUsersError.message}`,
          );
        }
        const featuredUserById = new Map(
          (featuredUsers || []).map((u: any) => [
            u.id as string,
            {
              id: u.id as string,
              displayName: (u.display_name as string | null) ?? null,
              avatarUrl: (u.avatar_url as string | null) ?? null,
            },
          ]),
        );
        for (const row of featuredRows as any[]) {
          const user = featuredUserById.get(row.featured_user_id);
          if (!user) continue;
          const list = featuredBySongId.get(row.song_id) ?? [];
          list.push(user);
          featuredBySongId.set(row.song_id, list);
        }
      }
    }

    // Real per-song stats sourced from `plays` and `likes` so the values
    // displayed on the public artist profile reflect actual activity.
    const realPlaysBySongId = new Map<string, number>();
    const realListenersBySongId = new Map<string, number>();
    const realLikesBySongId = new Map<string, number>();
    if (songIds.length > 0) {
      const { data: statsRows, error: statsError } = await supabase.rpc(
        'get_artist_song_stats',
        // p_since explicitly null = lifetime stats (do not rely on SQL default).
        { p_song_ids: songIds, p_since: null },
      );
      if (statsError) {
        this.logger.warn(
          `get_artist_song_stats RPC unavailable on artist profile: ${statsError.message}`,
        );
      } else {
        for (const row of (statsRows ?? []) as Array<{
          song_id: string;
          plays_count: number | string | null;
          listener_count_sum: number | string | null;
          like_count: number | string | null;
        }>) {
          if (!row.song_id) continue;
          realPlaysBySongId.set(row.song_id, Number(row.plays_count) || 0);
          realListenersBySongId.set(
            row.song_id,
            Number(row.listener_count_sum) || 0,
          );
          realLikesBySongId.set(row.song_id, Number(row.like_count) || 0);
        }
      }
    }

    const earsBySongId = new Map<string, number>();
    const listensBySongId = new Map<string, number>();
    if (songIds.length > 0) {
      try {
        const [{ data: earsRows }, { data: listenRows }] = await Promise.all([
          supabase.rpc('get_song_ears_reached', { p_song_ids: songIds }),
          supabase.rpc('get_song_listen_count', { p_song_ids: songIds }),
        ]);
        for (const row of (earsRows ?? []) as Array<{
          song_id: string;
          ears: number | string | null;
        }>) {
          const value = Number(row.ears);
          if (row.song_id && Number.isFinite(value)) {
            earsBySongId.set(row.song_id, Math.max(0, Math.round(value)));
          }
        }
        for (const row of (listenRows ?? []) as Array<{
          song_id: string;
          listens: number | string | null;
        }>) {
          const value = Number(row.listens);
          if (row.song_id && Number.isFinite(value)) {
            listensBySongId.set(row.song_id, Math.max(0, Math.round(value)));
          }
        }
      } catch {
        // RPC may not exist in this environment.
      }
    }

    let artistEarsReached: number | null = null;
    let artistListenCount: number | null = null;
    try {
      const { data, error } = await supabase.rpc('get_artist_ears_reached', {
        p_artist_id: resolvedUserId,
      });
      if (!error && data != null) {
        const value = Number(data);
        if (Number.isFinite(value)) {
          artistEarsReached = Math.max(0, Math.round(value));
        }
      }
    } catch {
      // RPC may not exist in this environment.
    }
    try {
      const { data, error } = await supabase.rpc('get_artist_listen_count', {
        p_artist_id: resolvedUserId,
      });
      if (!error && data != null) {
        const value = Number(data);
        if (Number.isFinite(value)) {
          artistListenCount = Math.max(0, Math.round(value));
        }
      }
    } catch {
      // RPC may not exist in this environment.
    }

    // Which of these songs has the viewer already purchased? Owners/admins see
    // all of their own tracks as owned; everyone else only the ones they bought.
    const purchasedSongIds = new Set<string>();
    if (viewerUserId && !requestingOwnProfile && songRows.length > 0) {
      const { data: purchaseRows } = await supabase
        .from('song_purchases')
        .select('song_id')
        .eq('user_id', viewerUserId)
        .eq('status', 'completed')
        .in(
          'song_id',
          songRows.map((s) => s.id),
        );
      for (const row of (purchaseRows ?? []) as Array<{ song_id: string }>) {
        if (row.song_id) purchasedSongIds.add(row.song_id);
      }
    }

    const mappedSongs = await Promise.all(
      songRows.map(async (song) => {
        const playCount =
          realPlaysBySongId.get(song.id) ?? song.play_count ?? 0;
        const profilePlayCount = song.profile_play_count || 0;
        const likeCount =
          realLikesBySongId.get(song.id) ?? (song.like_count || 0);
        const listenCount =
          listensBySongId.get(song.id) ??
          earsBySongId.get(song.id) ??
          realListenersBySongId.get(song.id) ??
          0;
        const popularityScore = listenCount + likeCount * 3 + playCount;
        const owned =
          requestingOwnProfile || purchasedSongIds.has(song.id);
        // The full track lives in a private bucket. Preview = signed 30s sample
        // for everyone; the full file is only signed for owners/buyers. We also
        // back-fill `audioUrl` with the sample for non-owners so legacy clients
        // that still read `audioUrl` only ever get the 30-second preview.
        const sampleUrl = (await signSongAudioUrl(song.sample_url ?? null)) ?? null;
        const fullUrl = owned
          ? (await signSongAudioUrl(song.audio_url ?? null)) ?? null
          : null;
        return {
          id: song.id,
          title: song.title,
          artistId: song.artist_id,
          artistName: song.artist_name,
          audioUrl: fullUrl ?? sampleUrl,
          sampleUrl,
          previewUrl: sampleUrl,
          priceCents: song.price_cents ?? 99,
          forSale: song.is_for_sale !== false,
          owned,
          locked: !owned,
          artworkUrl: song.artwork_url,
          durationSeconds: song.duration_seconds || 0,
          playCount,
          profilePlayCount,
          listenCount,
          likeCount,
          popularityScore,
          createdAt: song.created_at,
          featuredArtists: featuredBySongId.get(song.id) ?? [],
        };
      }),
    );

    const popularSongs = [...mappedSongs]
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 10);

    const { count: followerCount, error: followerCountError } = await supabase
      .from('user_follows')
      .select('follower_user_id', { count: 'exact', head: true })
      .eq('followed_user_id', resolvedUserId);
    if (
      followerCountError &&
      !this.isMissingUserFollowsTable(followerCountError)
    ) {
      throw new BadRequestException(
        `Failed to load follower count: ${followerCountError.message}`,
      );
    }
    const { count: legacyFollowerCount } = await supabase
      .from('artist_follows')
      .select('user_id', { count: 'exact', head: true })
      .eq('artist_id', resolvedUserId);
    const mergedFollowerCount = Math.max(
      followerCount ?? 0,
      legacyFollowerCount ?? 0,
    );

    // Monthly listeners proxy: SUM of listener_count snapshots from radio plays
    // in the last 30 days. We don't track per-user radio listens individually,
    // so this reports total person-listen impressions over the window.
    let monthlyListenerCount = 0;
    if (songIds.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: monthlyRows, error: monthlyError } = await supabase.rpc(
        'get_artist_song_stats',
        {
          p_song_ids: songIds,
          p_since: thirtyDaysAgo.toISOString(),
        },
      );
      if (monthlyError) {
        this.logger.warn(
          `Monthly listener RPC failed: ${monthlyError.message}`,
        );
      } else {
        for (const row of (monthlyRows ?? []) as Array<{
          listener_count_sum: number | string | null;
        }>) {
          monthlyListenerCount += Number(row.listener_count_sum) || 0;
        }
      }
    }

    const totalPlays = mappedSongs.reduce((sum, s) => sum + s.playCount, 0);
    const summedSongListens = mappedSongs.reduce(
      (sum, s) => sum + s.listenCount,
      0,
    );
    const totalListens = Math.max(
      artistListenCount ?? 0,
      summedSongListens,
    );
    const earsReached = artistEarsReached ?? 0;

    const userRow = user;

    return {
      artist: {
        id: userRow.id,
        displayName: userRow.display_name ?? null,
        username: userRow.username ?? null,
        avatarUrl: userRow.avatar_url ?? null,
        bio: userRow.bio ?? null,
        headline: userRow.headline ?? null,
        role: userRow.role,
        socials: {
          instagramUrl: userRow.instagram_url ?? null,
          twitterUrl: userRow.twitter_url ?? null,
          youtubeUrl: userRow.youtube_url ?? null,
          tiktokUrl: userRow.tiktok_url ?? null,
          websiteUrl: userRow.website_url ?? null,
          soundcloudUrl: userRow.soundcloud_url ?? null,
          spotifyUrl: userRow.spotify_url ?? null,
          appleMusicUrl: userRow.apple_music_url ?? null,
          facebookUrl: userRow.facebook_url ?? null,
          snapchatUrl: userRow.snapchat_url ?? null,
        },
      },
      stats: {
        totalSongs: mappedSongs.length,
        followerCount: mergedFollowerCount,
        monthlyListenerCount: monthlyListenerCount ?? 0,
        totalPlayCount: totalPlays,
        totalListenCount: totalListens,
        earsReached,
      },
      popularSongs,
      librarySongs: mappedSongs,
    };
  }

  async followUser(
    firebaseUid: string,
    followedUserId: string,
  ): Promise<{ followed: true }> {
    const supabase = getSupabaseClient();
    const followerUserId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const resolvedFollowedUserId = await this.resolveUserId(followedUserId);
    if (followerUserId === resolvedFollowedUserId) {
      throw new ForbiddenException('Cannot follow yourself');
    }

    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', resolvedFollowedUserId)
      .maybeSingle();
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    const { error } = await supabase.from('user_follows').upsert(
      {
        follower_user_id: followerUserId,
        followed_user_id: resolvedFollowedUserId,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'follower_user_id,followed_user_id' },
    );
    const userFollowsMissing = this.isMissingUserFollowsTable(error);
    if (error && !userFollowsMissing) {
      throw new BadRequestException(`Failed to follow user: ${error.message}`);
    }

    // Backward compatibility for existing artist follow endpoints/features.
    const { error: legacyError } = await supabase.from('artist_follows').upsert(
      {
        user_id: followerUserId,
        artist_id: resolvedFollowedUserId,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,artist_id' },
    );
    // If primary table is unavailable, legacy insert must succeed.
    if (userFollowsMissing && legacyError) {
      throw new BadRequestException(
        `Failed to follow user: ${legacyError.message}`,
      );
    }

    return { followed: true };
  }

  async unfollowUser(
    firebaseUid: string,
    followedUserId: string,
  ): Promise<{ unfollowed: true }> {
    const supabase = getSupabaseClient();
    const followerUserId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const resolvedFollowedUserId = await this.resolveUserId(followedUserId);

    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_user_id', followerUserId)
      .eq('followed_user_id', resolvedFollowedUserId);
    if (error && !this.isMissingUserFollowsTable(error))
      throw new BadRequestException(
        `Failed to unfollow user: ${error.message}`,
      );

    // Backward compatibility cleanup.
    await supabase
      .from('artist_follows')
      .delete()
      .eq('user_id', followerUserId)
      .eq('artist_id', resolvedFollowedUserId);

    // Unfollow also clears favorite so radio alerts stop.
    await supabase
      .from('artist_favorites')
      .delete()
      .eq('user_id', followerUserId)
      .eq('artist_id', resolvedFollowedUserId);

    return { unfollowed: true };
  }

  /**
   * Favorite an artist for radio alerts. Also follows them (favorite ⊆ follow).
   */
  async favoriteArtist(
    firebaseUid: string,
    artistId: string,
  ): Promise<{ favorited: true; following: true }> {
    const supabase = getSupabaseClient();
    const userId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const resolvedArtistId = await this.resolveUserId(artistId);
    if (userId === resolvedArtistId) {
      throw new ForbiddenException('Cannot favorite yourself');
    }

    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', resolvedArtistId)
      .maybeSingle();
    if (!targetUser) {
      throw new NotFoundException('Artist not found');
    }

    // Favorite implies follow so the social graph stays consistent.
    await this.followUser(firebaseUid, resolvedArtistId);

    const { error } = await supabase.from('artist_favorites').upsert(
      {
        user_id: userId,
        artist_id: resolvedArtistId,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,artist_id' },
    );
    if (error) {
      throw new BadRequestException(
        `Failed to favorite artist: ${error.message}`,
      );
    }

    return { favorited: true, following: true };
  }

  async unfavoriteArtist(
    firebaseUid: string,
    artistId: string,
  ): Promise<{ favorited: false }> {
    const supabase = getSupabaseClient();
    const userId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const resolvedArtistId = await this.resolveUserId(artistId);

    const { error } = await supabase
      .from('artist_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('artist_id', resolvedArtistId);
    if (error) {
      throw new BadRequestException(
        `Failed to unfavorite artist: ${error.message}`,
      );
    }

    return { favorited: false };
  }

  async isFavoritingArtist(
    firebaseUid: string,
    artistId: string,
  ): Promise<{ favorited: boolean }> {
    const supabase = getSupabaseClient();
    const userId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const resolvedArtistId = await this.resolveUserId(artistId);

    const { data, error } = await supabase
      .from('artist_favorites')
      .select('artist_id')
      .eq('user_id', userId)
      .eq('artist_id', resolvedArtistId)
      .maybeSingle();
    if (error) {
      throw new BadRequestException(
        `Failed to check favorite: ${error.message}`,
      );
    }
    return { favorited: !!data };
  }

  async listMyFavoriteArtists(
    firebaseUid: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<{ items: Array<Record<string, unknown>> }> {
    const supabase = getSupabaseClient();
    const userId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const offset = Math.max(opts?.offset ?? 0, 0);

    const { data, error } = await supabase
      .from('artist_favorites')
      .select('artist_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new BadRequestException(
        `Failed to list favorites: ${error.message}`,
      );
    }

    const rows = data || [];
    const ids = rows.map((r: any) => r.artist_id as string).filter(Boolean);
    if (!ids.length) return { items: [] };

    const { data: users, error: usersError } = await this.selectFollowProfiles(
      supabase,
      ids,
    );
    if (usersError) {
      throw new BadRequestException(
        `Failed to list favorite profiles: ${usersError.message}`,
      );
    }

    const usersById = new Map(
      (users || []).map((u: any) => [u.id as string, u]),
    );
    const favoritedAtById = new Map(
      rows.map((r: any) => [r.artist_id as string, r.created_at]),
    );

    const items = ids
      .map((id) => usersById.get(id))
      .filter(Boolean)
      .map((u: any) => ({
        id: u.id,
        displayName: u.display_name ?? null,
        username: u.username ?? null,
        avatarUrl: u.avatar_url ?? null,
        headline: u.headline ?? null,
        role: u.role ?? null,
        favoritedAt: favoritedAtById.get(u.id) ?? null,
      }));
    return { items };
  }

  async isFollowingUser(
    firebaseUid: string,
    followedUserId: string,
  ): Promise<{ following: boolean }> {
    const followerUserId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const resolvedFollowedUserId = await this.resolveUserId(followedUserId);
    const following = await this.isFollowingByIds(
      followerUserId,
      resolvedFollowedUserId,
    );
    return { following };
  }

  async getFollowCounts(
    userId: string,
  ): Promise<{ followers: number; following: number }> {
    const supabase = getSupabaseClient();
    const resolvedUserId = await this.resolveUserId(userId);
    const [
      { count: followers, error: followersError },
      { count: following, error: followingError },
    ] = await Promise.all([
      supabase
        .from('user_follows')
        .select('follower_user_id', { count: 'exact', head: true })
        .eq('followed_user_id', resolvedUserId),
      supabase
        .from('user_follows')
        .select('followed_user_id', { count: 'exact', head: true })
        .eq('follower_user_id', resolvedUserId),
    ]);
    if (
      (followersError && !this.isMissingUserFollowsTable(followersError)) ||
      (followingError && !this.isMissingUserFollowsTable(followingError))
    ) {
      const err = followersError || followingError;
      throw new BadRequestException(
        `Failed to load follow counts: ${err?.message}`,
      );
    }
    if (
      this.isMissingUserFollowsTable(followersError) ||
      this.isMissingUserFollowsTable(followingError)
    ) {
      const [{ count: legacyFollowers }, { count: legacyFollowing }] =
        await Promise.all([
          supabase
            .from('artist_follows')
            .select('user_id', { count: 'exact', head: true })
            .eq('artist_id', resolvedUserId),
          supabase
            .from('artist_follows')
            .select('artist_id', { count: 'exact', head: true })
            .eq('user_id', resolvedUserId),
        ]);
      return {
        followers: legacyFollowers ?? 0,
        following: legacyFollowing ?? 0,
      };
    }
    const [{ count: legacyFollowers }, { count: legacyFollowing }] =
      await Promise.all([
        supabase
          .from('artist_follows')
          .select('user_id', { count: 'exact', head: true })
          .eq('artist_id', resolvedUserId),
        supabase
          .from('artist_follows')
          .select('artist_id', { count: 'exact', head: true })
          .eq('user_id', resolvedUserId),
      ]);
    return {
      followers: Math.max(followers ?? 0, legacyFollowers ?? 0),
      following: Math.max(following ?? 0, legacyFollowing ?? 0),
    };
  }

  async getFollowers(
    userId: string,
    limit = 100,
    offset = 0,
  ): Promise<{ items: FollowListItem[]; total: number }> {
    const supabase = getSupabaseClient();
    const resolvedUserId = await this.resolveUserId(userId);
    const pageSize = Math.min(Math.max(limit, 1), 200);
    const pageOffset = Math.max(offset, 0);

    const {
      data: rows,
      error,
      count,
    } = await supabase
      .from('user_follows')
      .select('follower_user_id', { count: 'exact' })
      .eq('followed_user_id', resolvedUserId)
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + pageSize - 1);
    if (error && !this.isMissingUserFollowsTable(error)) {
      throw new BadRequestException(
        `Failed to load followers: ${error.message}`,
      );
    }

    const legacyResult = this.isMissingUserFollowsTable(error)
      ? await supabase
          .from('artist_follows')
          .select('user_id', { count: 'exact' })
          .eq('artist_id', resolvedUserId)
          .order('created_at', { ascending: false })
          .range(pageOffset, pageOffset + pageSize - 1)
      : null;
    const legacyRows = legacyResult?.data ?? null;

    const ids = (
      (rows || []).length
        ? (rows || []).map((r: any) => r.follower_user_id as string)
        : (legacyRows || []).map((r: any) => r.user_id as string)
    ).filter(Boolean);
    if (!ids.length) {
      return { items: [], total: count ?? 0 };
    }

    const { data: users, error: usersError } = await this.selectFollowProfiles(
      supabase,
      ids,
    );
    if (usersError) {
      throw new BadRequestException(
        `Failed to load follower profiles: ${usersError.message}`,
      );
    }

    // Relationship is computed from the profile owner's perspective: a follower
    // the owner also follows back is a "friend", otherwise they are a "fan".
    const ownerFollowing = await this.getFollowedUserIds(resolvedUserId).catch(
      () => new Set<string>(),
    );

    const usersById = new Map(
      (users || []).map((u: any) => [u.id as string, u]),
    );
    const items: FollowListItem[] = ids
      .map((id) => usersById.get(id))
      .filter(Boolean)
      .map((u: any) => ({
        id: u.id,
        displayName: u.display_name ?? null,
        username: u.username ?? null,
        avatarUrl: u.avatar_url ?? null,
        headline: u.headline ?? null,
        role: (u.role as FollowListItem['role']) ?? null,
        relationship: ownerFollowing.has(u.id) ? 'friend' : 'fan',
      }));

    return { items, total: count ?? legacyResult?.count ?? items.length };
  }

  async getFollowing(
    userId: string,
    limit = 100,
    offset = 0,
  ): Promise<{ items: FollowListItem[]; total: number }> {
    const supabase = getSupabaseClient();
    const resolvedUserId = await this.resolveUserId(userId);
    const pageSize = Math.min(Math.max(limit, 1), 200);
    const pageOffset = Math.max(offset, 0);

    const {
      data: rows,
      error,
      count,
    } = await supabase
      .from('user_follows')
      .select('followed_user_id', { count: 'exact' })
      .eq('follower_user_id', resolvedUserId)
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + pageSize - 1);
    if (error && !this.isMissingUserFollowsTable(error)) {
      throw new BadRequestException(
        `Failed to load following list: ${error.message}`,
      );
    }

    const legacyResult = this.isMissingUserFollowsTable(error)
      ? await supabase
          .from('artist_follows')
          .select('artist_id', { count: 'exact' })
          .eq('user_id', resolvedUserId)
          .order('created_at', { ascending: false })
          .range(pageOffset, pageOffset + pageSize - 1)
      : null;
    const legacyRows = legacyResult?.data ?? null;

    const ids = (
      (rows || []).length
        ? (rows || []).map((r: any) => r.followed_user_id as string)
        : (legacyRows || []).map((r: any) => r.artist_id as string)
    ).filter(Boolean);
    if (!ids.length) {
      return { items: [], total: count ?? 0 };
    }

    const { data: users, error: usersError } = await this.selectFollowProfiles(
      supabase,
      ids,
    );
    if (usersError) {
      throw new BadRequestException(
        `Failed to load following profiles: ${usersError.message}`,
      );
    }

    // From the owner's perspective: someone the owner follows who also follows
    // the owner back is a "friend", otherwise the owner is just "following".
    const ownerFollowers = await this.getFollowerUserIds(resolvedUserId).catch(
      () => new Set<string>(),
    );

    const usersById = new Map(
      (users || []).map((u: any) => [u.id as string, u]),
    );
    const items: FollowListItem[] = ids
      .map((id) => usersById.get(id))
      .filter(Boolean)
      .map((u: any) => ({
        id: u.id,
        displayName: u.display_name ?? null,
        username: u.username ?? null,
        avatarUrl: u.avatar_url ?? null,
        headline: u.headline ?? null,
        role: (u.role as FollowListItem['role']) ?? null,
        relationship: ownerFollowers.has(u.id) ? 'friend' : 'following',
      }));

    return { items, total: count ?? legacyResult?.count ?? items.length };
  }

  /**
   * Friends = mutual follows (the user follows them and they follow back).
   * Drives the share-to-friends picker and the profile "Friends" tab.
   */
  async getFriends(
    userId: string,
    limit = 200,
    offset = 0,
  ): Promise<{ items: FollowListItem[]; total: number }> {
    const supabase = getSupabaseClient();
    const resolvedUserId = await this.resolveUserId(userId);
    const [following, followers] = await Promise.all([
      this.getFollowedUserIds(resolvedUserId).catch(() => new Set<string>()),
      this.getFollowerUserIds(resolvedUserId).catch(() => new Set<string>()),
    ]);
    const mutualIds = [...following].filter((id) => followers.has(id));
    const total = mutualIds.length;
    if (!total) return { items: [], total: 0 };

    const pageSize = Math.min(Math.max(limit, 1), 500);
    const pageOffset = Math.max(offset, 0);
    const pageIds = mutualIds.slice(pageOffset, pageOffset + pageSize);
    if (!pageIds.length) return { items: [], total };

    const { data: users, error: usersError } = await this.selectFollowProfiles(
      supabase,
      pageIds,
    );
    if (usersError) {
      throw new BadRequestException(
        `Failed to load friends: ${usersError.message}`,
      );
    }
    const usersById = new Map(
      (users || []).map((u: any) => [u.id as string, u]),
    );
    const items: FollowListItem[] = pageIds
      .map((id) => usersById.get(id))
      .filter(Boolean)
      .map((u: any) => ({
        id: u.id,
        displayName: u.display_name ?? null,
        username: u.username ?? null,
        avatarUrl: u.avatar_url ?? null,
        headline: u.headline ?? null,
        role: (u.role as FollowListItem['role']) ?? null,
        relationship: 'friend',
      }));
    return { items, total };
  }

  /**
   * Select follow-list profile fields, tolerating envs where the username
   * column hasn't been migrated yet.
   */
  private async selectFollowProfiles(
    supabase: ReturnType<typeof getSupabaseClient>,
    ids: string[],
  ): Promise<{ data: any[] | null; error: { message: string } | null }> {
    const withUsername = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url, headline, role')
      .in('id', ids);
    if (!withUsername.error) {
      return { data: withUsername.data, error: null };
    }
    if (!this.isMissingUsernameColumn(withUsername.error)) {
      return { data: null, error: withUsername.error };
    }
    const fallback = await supabase
      .from('users')
      .select('id, display_name, avatar_url, headline, role')
      .in('id', ids);
    return { data: fallback.data, error: fallback.error };
  }

  async getFollowerUserIds(userId: string): Promise<Set<string>> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_follows')
      .select('follower_user_id')
      .eq('followed_user_id', userId);
    if (!error) {
      return new Set(
        (data || []).map((r: any) => r.follower_user_id as string),
      );
    }
    if (!this.isMissingUserFollowsTable(error)) {
      throw new BadRequestException(
        `Failed to load followers: ${error.message}`,
      );
    }
    const { data: legacyData, error: legacyError } = await supabase
      .from('artist_follows')
      .select('user_id')
      .eq('artist_id', userId);
    if (legacyError) {
      throw new BadRequestException(
        `Failed to load followers: ${legacyError.message}`,
      );
    }
    return new Set((legacyData || []).map((r: any) => r.user_id as string));
  }

  async getFollowedUserIds(followerUserId: string): Promise<Set<string>> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_follows')
      .select('followed_user_id')
      .eq('follower_user_id', followerUserId);
    if (!error) {
      return new Set(
        (data || []).map((r: any) => r.followed_user_id as string),
      );
    }
    if (!this.isMissingUserFollowsTable(error)) {
      throw new BadRequestException(
        `Failed to load followed users: ${error.message}`,
      );
    }
    const { data: legacyData, error: legacyError } = await supabase
      .from('artist_follows')
      .select('artist_id')
      .eq('user_id', followerUserId);
    if (legacyError) {
      throw new BadRequestException(
        `Failed to load followed users: ${legacyError.message}`,
      );
    }
    return new Set((legacyData || []).map((r: any) => r.artist_id as string));
  }

  async isFollowingByIds(
    followerUserId: string,
    followedUserId: string,
  ): Promise<boolean> {
    if (!followerUserId || !followedUserId) return false;
    if (followerUserId === followedUserId) return false;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_follows')
      .select('follower_user_id')
      .eq('follower_user_id', followerUserId)
      .eq('followed_user_id', followedUserId)
      .maybeSingle();
    if (error && !this.isMissingUserFollowsTable(error)) {
      throw new BadRequestException(
        `Failed to check follow status: ${error.message}`,
      );
    }
    if (!error && data) return true;

    const { data: legacyData } = await supabase
      .from('artist_follows')
      .select('user_id')
      .eq('user_id', followerUserId)
      .eq('artist_id', followedUserId)
      .maybeSingle();
    if (legacyData) return true;
    return Boolean(data);
  }

  async canSendDirectMessage(
    senderUserId: string,
    recipientUserId: string,
  ): Promise<boolean> {
    if (await this.areUsersBlocked(senderUserId, recipientUserId)) {
      return false;
    }
    return this.isFollowingByIds(senderUserId, recipientUserId);
  }

  /** True when either user has blocked the other. */
  async areUsersBlocked(userA: string, userB: string): Promise<boolean> {
    if (userA === userB) return false;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_blocks')
      .select('id')
      .or(
        `and(blocker_user_id.eq.${userA},blocked_user_id.eq.${userB}),and(blocker_user_id.eq.${userB},blocked_user_id.eq.${userA})`,
      )
      .limit(1);
    if (error) {
      if (this.isMissingTableError(error, 'user_blocks')) return false;
      throw new BadRequestException(
        `Failed to check block status: ${error.message}`,
      );
    }
    return (data ?? []).length > 0;
  }

  /** Author IDs the viewer should not see in feeds (both directions). */
  async getHiddenAuthorIds(viewerUserId: string): Promise<Set<string>> {
    const supabase = getSupabaseClient();
    const [{ data: blocked }, { data: blockedBy }] = await Promise.all([
      supabase
        .from('user_blocks')
        .select('blocked_user_id')
        .eq('blocker_user_id', viewerUserId),
      supabase
        .from('user_blocks')
        .select('blocker_user_id')
        .eq('blocked_user_id', viewerUserId),
    ]);
    const hidden = new Set<string>();
    for (const row of blocked ?? []) {
      hidden.add(row.blocked_user_id as string);
    }
    for (const row of blockedBy ?? []) {
      hidden.add(row.blocker_user_id as string);
    }
    return hidden;
  }

  async getBlockStatus(
    firebaseUid: string,
    targetUserId: string,
  ): Promise<{ blockedByMe: boolean; blockedMe: boolean }> {
    const viewerId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const targetId = await this.resolveUserId(targetUserId);
    const supabase = getSupabaseClient();
    const [{ data: byMe }, { data: me }] = await Promise.all([
      supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_user_id', viewerId)
        .eq('blocked_user_id', targetId)
        .maybeSingle(),
      supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_user_id', targetId)
        .eq('blocked_user_id', viewerId)
        .maybeSingle(),
    ]);
    return { blockedByMe: !!byMe, blockedMe: !!me };
  }

  async reportUser(
    firebaseUid: string,
    reportedUserId: string,
    reason: string,
    context?: { contextType?: string; contextId?: string },
  ): Promise<{ reported: true }> {
    const reporterId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const targetId = await this.resolveUserId(reportedUserId);
    if (reporterId === targetId) {
      throw new ForbiddenException('Cannot report yourself');
    }
    const trimmed = reason.trim().slice(0, 2000);
    if (!trimmed) {
      throw new BadRequestException('Report reason is required');
    }
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('user_reports').insert({
      reporter_user_id: reporterId,
      reported_user_id: targetId,
      reason: trimmed,
      context_type: context?.contextType?.trim() || null,
      context_id: context?.contextId || null,
    });
    if (error) {
      throw new BadRequestException(`Failed to submit report: ${error.message}`);
    }
    return { reported: true };
  }

  async blockUser(
    firebaseUid: string,
    blockedUserId: string,
  ): Promise<{ blocked: true }> {
    const blockerId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const targetId = await this.resolveUserId(blockedUserId);
    if (blockerId === targetId) {
      throw new ForbiddenException('Cannot block yourself');
    }
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('user_blocks').upsert(
      {
        blocker_user_id: blockerId,
        blocked_user_id: targetId,
      },
      { onConflict: 'blocker_user_id,blocked_user_id' },
    );
    if (error) {
      throw new BadRequestException(`Failed to block user: ${error.message}`);
    }
    // Stop following in both directions when blocking.
    await supabase
      .from('user_follows')
      .delete()
      .or(
        `and(follower_user_id.eq.${blockerId},followed_user_id.eq.${targetId}),and(follower_user_id.eq.${targetId},followed_user_id.eq.${blockerId})`,
      );
    await supabase
      .from('artist_follows')
      .delete()
      .or(
        `and(user_id.eq.${blockerId},artist_id.eq.${targetId}),and(user_id.eq.${targetId},artist_id.eq.${blockerId})`,
      );
    await supabase
      .from('artist_favorites')
      .delete()
      .or(
        `and(user_id.eq.${blockerId},artist_id.eq.${targetId}),and(user_id.eq.${targetId},artist_id.eq.${blockerId})`,
      );
    return { blocked: true };
  }

  async unblockUser(
    firebaseUid: string,
    blockedUserId: string,
  ): Promise<{ unblocked: true }> {
    const blockerId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const targetId = await this.resolveUserId(blockedUserId);
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_user_id', blockerId)
      .eq('blocked_user_id', targetId);
    if (error) {
      throw new BadRequestException(`Failed to unblock user: ${error.message}`);
    }
    return { unblocked: true };
  }

  async listBlockedUsers(firebaseUid: string): Promise<{
    items: Array<{
      userId: string;
      displayName: string | null;
      username: string | null;
      avatarUrl: string | null;
      blockedAt: string;
    }>;
  }> {
    const viewerId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const supabase = getSupabaseClient();
    const { data: rows, error } = await supabase
      .from('user_blocks')
      .select('blocked_user_id, created_at')
      .eq('blocker_user_id', viewerId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new BadRequestException(
        `Failed to load blocked users: ${error.message}`,
      );
    }
    const ids = (rows ?? []).map((r) => r.blocked_user_id as string);
    if (!ids.length) return { items: [] };
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url')
      .in('id', ids);
    if (usersError) {
      throw new BadRequestException(
        `Failed to load blocked profiles: ${usersError.message}`,
      );
    }
    const byId = new Map((users ?? []).map((u) => [u.id as string, u]));
    const items = (rows ?? []).map((row) => {
      const u = byId.get(row.blocked_user_id as string);
      return {
        userId: row.blocked_user_id as string,
        displayName: (u?.display_name as string | null) ?? null,
        username: (u?.username as string | null) ?? null,
        avatarUrl: (u?.avatar_url as string | null) ?? null,
        blockedAt: row.created_at as string,
      };
    });
    return { items };
  }

  private isMissingTableError(error: unknown, tableName: string): boolean {
    const maybe = error as { code?: string; message?: string } | null;
    const message = (maybe?.message ?? '').toLowerCase();
    if (maybe?.code === '42P01') {
      return message.includes(tableName.toLowerCase());
    }
    if (maybe?.code === 'PGRST205') {
      return (
        message.includes(`'${tableName.toLowerCase()}'`) ||
        message.includes(tableName.toLowerCase())
      );
    }
    return false;
  }
}
