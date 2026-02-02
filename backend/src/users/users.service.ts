import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Transform snake_case DB response to camelCase for frontend
export interface UserResponse {
  id: string;
  email: string;
  displayName: string | null;
  role: 'listener' | 'artist' | 'admin';
  avatarUrl: string | null;
  createdAt: string;
  firebaseUid: string;
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
  };
}

@Injectable()
export class UsersService {
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
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        firebase_uid: firebaseUid,
        email: createUserDto.email,
        display_name: createUserDto.displayName,
        role: createUserDto.role,
      })
      .select()
      .single();

    if (error) {
      // Handle race condition where user was created between check and insert
      if (error.code === '23505') { // unique_violation
        const { data: raceUser } = await supabase
          .from('users')
          .select('*')
          .eq('firebase_uid', firebaseUid)
          .single();
        if (raceUser) return transformUser(raceUser);
      }
      throw new BadRequestException(`Failed to create user: ${error.message}`);
    }

    // Credits for artists are created by DB trigger initialize_credits_on_user_create

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

    const { data, error } = await supabase
      .from('users')
      .update({
        display_name: updateUserDto.displayName,
        avatar_url: updateUserDto.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return transformUser(data);
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
