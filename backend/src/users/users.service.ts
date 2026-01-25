import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Transform snake_case DB response to camelCase for frontend
interface UserResponse {
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
      throw new Error(`Failed to create user: ${error.message}`);
    }

    // Initialize credits if artist
    if (createUserDto.role === 'artist') {
      await supabase.from('credits').insert({
        artist_id: data.id,
        balance: 0,
      });
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
}
