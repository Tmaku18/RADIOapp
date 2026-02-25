import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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
    const role = adminEmails.includes(emailLower)
      ? 'admin'
      : (createUserDto.role ?? 'listener');
    const { data, error } = await supabase
      .from('users')
      .insert({
        firebase_uid: firebaseUid,
        email: createUserDto.email,
        display_name: createUserDto.displayName,
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

    // Credits for artists are created by DB trigger

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
      .select('id')
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

    // Check if already an artist or admin
    if (user.role === 'artist') {
      throw new BadRequestException('User is already an artist');
    }
    if (user.role === 'admin') {
      throw new BadRequestException('Admin users cannot be upgraded to artist');
    }

    // Update role to artist
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
}
