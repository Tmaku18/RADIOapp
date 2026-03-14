import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from '../config/supabase.config';
import { UploadsService } from '../uploads/uploads.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Transform snake_case DB response to camelCase for frontend
export interface UserResponse {
  id: string;
  email: string;
  displayName: string | null;
  role: 'listener' | 'artist' | 'admin' | 'service_provider';
  avatarUrl: string | null;
  createdAt: string;
  firebaseUid: string;
  region?: string | null;
  suggestLocalArtists?: boolean;
  bio?: string | null;
  headline?: string | null;
  locationRegion?: string | null;
  discoverable?: boolean;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  websiteUrl?: string | null;
}

function transformUser(data: any): UserResponse {
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
    firebaseUid: data.firebase_uid,
    region: data.region ?? null,
    suggestLocalArtists: data.suggest_local_artists ?? true,
    bio: data.bio ?? null,
    headline: data.headline ?? null,
    locationRegion: data.location_region ?? null,
    discoverable: data.discoverable ?? true,
    instagramUrl: data.instagram_url ?? null,
    twitterUrl: data.twitter_url ?? null,
    youtubeUrl: data.youtube_url ?? null,
    tiktokUrl: data.tiktok_url ?? null,
    websiteUrl: data.website_url ?? null,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly configService: ConfigService,
  ) {}

  /** Admin emails from env (comma-separated); login with one of these gets role admin. */
  private getAdminEmails(): string[] {
    const raw = this.configService.get<string>('ADMIN_EMAILS');
    if (!raw?.trim()) return [];
    return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  }

  /** Returns true if the given email is in the admin allowlist (for first-time login detection). */
  isAdminEmail(email: string | null | undefined): boolean {
    if (!email?.trim()) return false;
    return this.getAdminEmails().includes(email.trim().toLowerCase());
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
    // Default all non-admin users to listener. They can switch roles later in profile settings.
    const role = adminEmails.includes(emailLower)
      ? 'admin'
      : 'listener';
    const displayName = createUserDto.displayName?.trim() || null;
    const { data, error } = await supabase
      .from('users')
      .insert({
        firebase_uid: firebaseUid,
        email: createUserDto.email,
        display_name: displayName,
        role,
      })
      .select()
      .single();

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

    return transformUser(data);
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<UserResponse> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (error || !data) {
      throw new NotFoundException('User not found');
    }

    return transformUser(data);
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

  async getUserById(userId: string): Promise<UserResponse> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('User not found');
    }

    return transformUser(data);
  }

  async updateUser(firebaseUid: string, updateUserDto: UpdateUserDto): Promise<UserResponse> {
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
    if (updateUserDto.displayName !== undefined) updatePayload.display_name = updateUserDto.displayName;
    if (updateUserDto.avatarUrl !== undefined) updatePayload.avatar_url = updateUserDto.avatarUrl;
    if (updateUserDto.region !== undefined) updatePayload.region = updateUserDto.region;
    if (updateUserDto.suggestLocalArtists !== undefined) updatePayload.suggest_local_artists = updateUserDto.suggestLocalArtists;
    if (updateUserDto.bio !== undefined) updatePayload.bio = updateUserDto.bio;
    if (updateUserDto.headline !== undefined) updatePayload.headline = updateUserDto.headline;
    if (updateUserDto.locationRegion !== undefined) updatePayload.location_region = updateUserDto.locationRegion;
    if (updateUserDto.discoverable !== undefined) updatePayload.discoverable = updateUserDto.discoverable;
    if (updateUserDto.instagramUrl !== undefined) updatePayload.instagram_url = updateUserDto.instagramUrl || null;
    if (updateUserDto.twitterUrl !== undefined) updatePayload.twitter_url = updateUserDto.twitterUrl || null;
    if (updateUserDto.youtubeUrl !== undefined) updatePayload.youtube_url = updateUserDto.youtubeUrl || null;
    if (updateUserDto.tiktokUrl !== undefined) updatePayload.tiktok_url = updateUserDto.tiktokUrl || null;
    if (updateUserDto.websiteUrl !== undefined) updatePayload.website_url = updateUserDto.websiteUrl || null;
    if (updateUserDto.role !== undefined) {
      if (user.role === 'admin') {
        throw new BadRequestException('Admin users cannot change account type here.');
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
          console.error('Failed to create credits for new artist:', creditsError);
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
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return transformUser(data);
  }

  /**
   * Upload a profile picture and set it as the user's avatar.
   * Accepts JPEG, PNG, WebP up to 2MB.
   */
  async updateAvatar(firebaseUid: string, file: Express.Multer.File): Promise<UserResponse> {
    const supabase = getSupabaseClient();
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (fetchError || !user) {
      throw new NotFoundException('User not found');
    }

    const avatarUrl = await this.uploadsService.uploadProfileImage(file, user.id);

    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestException(`Failed to update avatar: ${updateError.message}`);
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
      throw new Error(`Failed to upgrade user: ${updateError.message}`);
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
      throw new BadRequestException('You are already a Catalyst');
    }
    if (user.role === 'admin') {
      throw new BadRequestException('Admin users cannot be upgraded to Catalyst');
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
      throw new BadRequestException(`Failed to upgrade: ${updateError.message}`);
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
  async getArtistProfile(userId: string) {
    const supabase = getSupabaseClient();
    // Use select('*') for backward compatibility when some envs lag migrations.
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('Artist not found');
    }

    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select(
        [
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
        ].join(','),
      )
      .eq('artist_id', userId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (songsError) {
      throw new BadRequestException(
        `Failed to load artist songs: ${songsError.message}`,
      );
    }

    const songRows = (songs ?? []) as any[];
    const mappedSongs = songRows.map((song) => {
      const playCount = song.play_count || 0;
      const profilePlayCount = song.profile_play_count || 0;
      const likeCount = song.like_count || 0;
      const popularityScore = playCount + profilePlayCount + likeCount * 3;
      return {
        id: song.id,
        title: song.title,
        artistId: song.artist_id,
        artistName: song.artist_name,
        audioUrl: song.audio_url,
        artworkUrl: song.artwork_url,
        durationSeconds: song.duration_seconds || 0,
        playCount,
        profilePlayCount,
        likeCount,
        popularityScore,
        createdAt: song.created_at,
      };
    });

    const popularSongs = [...mappedSongs]
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 10);

    const { count: followerCount } = await supabase
      .from('user_follows')
      .select('follower_user_id', { count: 'exact', head: true })
      .eq('followed_user_id', userId);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: monthlyListenerCount } = await supabase
      .from('song_profile_listens')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    const totalPlays = mappedSongs.reduce(
      (sum, s) => sum + s.playCount + s.profilePlayCount,
      0,
    );

    const userRow = user as any;

    return {
      artist: {
        id: userRow.id,
        displayName: userRow.display_name ?? null,
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
        },
      },
      stats: {
        totalSongs: mappedSongs.length,
        followerCount: followerCount ?? 0,
        monthlyListenerCount: monthlyListenerCount ?? 0,
        totalPlayCount: totalPlays,
      },
      popularSongs,
      librarySongs: mappedSongs,
    };
  }

  async followUser(firebaseUid: string, followedUserId: string): Promise<{ followed: true }> {
    const supabase = getSupabaseClient();
    const followerUserId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    if (followerUserId === followedUserId) {
      throw new ForbiddenException('Cannot follow yourself');
    }

    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', followedUserId)
      .maybeSingle();
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    const { error } = await supabase
      .from('user_follows')
      .upsert(
        {
          follower_user_id: followerUserId,
          followed_user_id: followedUserId,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'follower_user_id,followed_user_id' },
      );
    if (error) throw new BadRequestException(`Failed to follow user: ${error.message}`);

    // Backward compatibility for existing artist follow endpoints/features.
    await supabase
      .from('artist_follows')
      .upsert(
        {
          user_id: followerUserId,
          artist_id: followedUserId,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,artist_id' },
      );

    return { followed: true };
  }

  async unfollowUser(firebaseUid: string, followedUserId: string): Promise<{ unfollowed: true }> {
    const supabase = getSupabaseClient();
    const followerUserId = await this.getDbUserIdByFirebaseUid(firebaseUid);

    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_user_id', followerUserId)
      .eq('followed_user_id', followedUserId);
    if (error) throw new BadRequestException(`Failed to unfollow user: ${error.message}`);

    // Backward compatibility cleanup.
    await supabase
      .from('artist_follows')
      .delete()
      .eq('user_id', followerUserId)
      .eq('artist_id', followedUserId);

    return { unfollowed: true };
  }

  async isFollowingUser(firebaseUid: string, followedUserId: string): Promise<{ following: boolean }> {
    const followerUserId = await this.getDbUserIdByFirebaseUid(firebaseUid);
    const following = await this.isFollowingByIds(followerUserId, followedUserId);
    return { following };
  }

  async getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
    const supabase = getSupabaseClient();
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase
        .from('user_follows')
        .select('follower_user_id', { count: 'exact', head: true })
        .eq('followed_user_id', userId),
      supabase
        .from('user_follows')
        .select('followed_user_id', { count: 'exact', head: true })
        .eq('follower_user_id', userId),
    ]);
    return {
      followers: followers ?? 0,
      following: following ?? 0,
    };
  }

  async getFollowedUserIds(followerUserId: string): Promise<Set<string>> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_follows')
      .select('followed_user_id')
      .eq('follower_user_id', followerUserId);
    return new Set((data || []).map((r: any) => r.followed_user_id as string));
  }

  async isFollowingByIds(followerUserId: string, followedUserId: string): Promise<boolean> {
    if (!followerUserId || !followedUserId) return false;
    if (followerUserId === followedUserId) return false;
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_follows')
      .select('follower_user_id')
      .eq('follower_user_id', followerUserId)
      .eq('followed_user_id', followedUserId)
      .maybeSingle();
    return Boolean(data);
  }

  async canSendDirectMessage(senderUserId: string, recipientUserId: string): Promise<boolean> {
    return this.isFollowingByIds(senderUserId, recipientUserId);
  }
}
