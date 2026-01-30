import { Injectable, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { CreateUserDto } from './dto/create-user.dto';

interface UserRow {
  id: string;
  firebase_uid?: string;
  email?: string;
  display_name?: string | null;
  role: string;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}
import { UpdateUserDto } from './dto/update-user.dto';

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

    const existing = existingUser as UserRow | null;
    if (existing) {
      return existing;
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
      if (error.code === '23505') {
        const { data: raceUser } = await supabase
          .from('users')
          .select('*')
          .eq('firebase_uid', firebaseUid)
          .single();
        const race = raceUser as UserRow | null;
        if (race) return race;
      }
      throw new Error(`Failed to create user: ${error.message}`);
    }

    const created = data as UserRow;

    // Initialize credits if artist
    if (createUserDto.role === 'artist') {
      await supabase.from('credits').insert({
        artist_id: created.id,
        balance: 0,
      });
    }

    return data;
  }

  async getUserByFirebaseUid(firebaseUid: string) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (error || !data) {
      throw new NotFoundException('User not found');
    }

    return data as UserRow;
  }

  async getUserById(userId: string): Promise<UserRow> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('User not found');
    }

    return data as UserRow;
  }

  async updateUser(
    firebaseUid: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserRow> {
    const supabase = getSupabaseClient();

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();

    const userRow = userData as { id: string } | null;
    if (!userRow) {
      throw new NotFoundException('User not found');
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        display_name: updateUserDto.displayName,
        avatar_url: updateUserDto.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userRow.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return data as UserRow;
  }
}
