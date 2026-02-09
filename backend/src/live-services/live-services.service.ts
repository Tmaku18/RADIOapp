import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

export type LiveServiceType = 'performance' | 'session' | 'meetup';

@Injectable()
export class LiveServicesService {
  async create(artistId: string, data: { title: string; description?: string; type?: LiveServiceType; scheduledAt?: string; linkOrPlace?: string }) {
    const supabase = getSupabaseClient();
    const { data: row, error } = await supabase
      .from('artist_live_services')
      .insert({
        artist_id: artistId,
        title: data.title,
        description: data.description ?? null,
        type: data.type ?? 'performance',
        scheduled_at: data.scheduledAt ?? null,
        link_or_place: data.linkOrPlace ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to create live service: ${error.message}`);
    return this.mapRow(row);
  }

  async listByArtist(artistId: string): Promise<any[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('artist_live_services')
      .select('*')
      .eq('artist_id', artistId)
      .order('scheduled_at', { ascending: true, nullsFirst: false });
    if (error) throw new Error(`Failed to list live services: ${error.message}`);
    return (data || []).map(this.mapRow);
  }

  async listMine(artistId: string): Promise<any[]> {
    return this.listByArtist(artistId);
  }

  async getById(id: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('artist_live_services')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException('Live service not found');
    return this.mapRow(data);
  }

  async update(id: string, artistId: string, data: { title?: string; description?: string; type?: LiveServiceType; scheduledAt?: string; linkOrPlace?: string }) {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase.from('artist_live_services').select('artist_id').eq('id', id).single();
    if (!existing || existing.artist_id !== artistId) throw new ForbiddenException('Not your live service');
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.type !== undefined) updates.type = data.type;
    if (data.scheduledAt !== undefined) updates.scheduled_at = data.scheduledAt;
    if (data.linkOrPlace !== undefined) updates.link_or_place = data.linkOrPlace;
    const { data: row, error } = await supabase.from('artist_live_services').update(updates).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update: ${error.message}`);
    return this.mapRow(row);
  }

  async delete(id: string, artistId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase.from('artist_live_services').select('artist_id').eq('id', id).single();
    if (!existing || existing.artist_id !== artistId) throw new ForbiddenException('Not your live service');
    const { error } = await supabase.from('artist_live_services').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete: ${error.message}`);
  }

  async upcomingFromFollowed(userId: string, limit = 20): Promise<any[]> {
    const supabase = getSupabaseClient();
    const { data: follows } = await supabase.from('artist_follows').select('artist_id').eq('user_id', userId);
    if (!follows?.length) return [];
    const artistIds = follows.map((f: any) => f.artist_id);
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('artist_live_services')
      .select('*')
      .in('artist_id', artistIds)
      .or(`scheduled_at.gte.${now},scheduled_at.is.null`)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .limit(limit);
    return (data || []).map(this.mapRow);
  }

  async followArtist(userId: string, artistId: string): Promise<void> {
    if (userId === artistId) throw new ForbiddenException('Cannot follow yourself');
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('artist_follows').upsert({ user_id: userId, artist_id: artistId }, { onConflict: 'user_id,artist_id' });
    if (error) throw new Error(`Failed to follow: ${error.message}`);
  }

  async unfollowArtist(userId: string, artistId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('artist_follows').delete().eq('user_id', userId).eq('artist_id', artistId);
    if (error) throw new Error(`Failed to unfollow: ${error.message}`);
  }

  async isFollowing(userId: string, artistId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('artist_follows').select('user_id').eq('user_id', userId).eq('artist_id', artistId).maybeSingle();
    return !!data;
  }

  private mapRow(row: any) {
    return {
      id: row.id,
      artistId: row.artist_id,
      title: row.title,
      description: row.description,
      type: row.type,
      scheduledAt: row.scheduled_at,
      linkOrPlace: row.link_or_place,
      createdAt: row.created_at,
    };
  }
}
