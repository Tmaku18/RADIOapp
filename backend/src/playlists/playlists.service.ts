import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { ProRadioSubscriptionService } from '../pro-radio-subscription/pro-radio-subscription.service';
import { PRO_RADIO_PAYWALL_PAYLOAD } from '../pro-radio-subscription/pro-radio-subscription.constants';
import { signSongAudioUrl } from '../common/song-audio.util';

@Injectable()
export class PlaylistsService {
  constructor(private readonly proRadioSub: ProRadioSubscriptionService) {}

  private async assertProRadio(userId: string): Promise<void> {
    const access = await this.proRadioSub.getAccess(userId);
    if (!access.hasAccess) {
      throw new ForbiddenException(PRO_RADIO_PAYWALL_PAYLOAD);
    }
  }

  private async getOwnedPlaylist(playlistId: string, userId: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_playlists')
      .select('*')
      .eq('id', playlistId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Playlist not found');
    return data;
  }

  async listMine(userId: string) {
    await this.assertProRadio(userId);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_playlists')
      .select('id, title, description, cover_url, is_public, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    const playlists = data ?? [];
    const counts = new Map<string, number>();
    if (playlists.length > 0) {
      const { data: tracks } = await supabase
        .from('user_playlist_tracks')
        .select('playlist_id')
        .in(
          'playlist_id',
          playlists.map((p) => p.id),
        );
      for (const row of tracks ?? []) {
        const id = (row as { playlist_id: string }).playlist_id;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return {
      playlists: playlists.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        coverUrl: p.cover_url,
        isPublic: p.is_public,
        trackCount: counts.get(p.id) ?? 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    };
  }

  async create(
    userId: string,
    body: { title: string; description?: string },
  ) {
    await this.assertProRadio(userId);
    const title = (body.title ?? '').trim();
    if (!title) throw new BadRequestException('Title is required');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_playlists')
      .insert({
        user_id: userId,
        title,
        description: (body.description ?? '').trim() || null,
        is_public: false,
      })
      .select('id, title, description, cover_url, is_public, created_at, updated_at')
      .single();
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Failed to create playlist');
    }
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      coverUrl: data.cover_url,
      isPublic: data.is_public,
      trackCount: 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async update(
    userId: string,
    playlistId: string,
    body: { title?: string; description?: string },
  ) {
    await this.assertProRadio(userId);
    await this.getOwnedPlaylist(playlistId, userId);
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) throw new BadRequestException('Title cannot be empty');
      update.title = title;
    }
    if (body.description !== undefined) {
      update.description = body.description.trim() || null;
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_playlists')
      .update(update)
      .eq('id', playlistId)
      .eq('user_id', userId)
      .select('id, title, description, cover_url, is_public, created_at, updated_at')
      .single();
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Failed to update playlist');
    }
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      coverUrl: data.cover_url,
      isPublic: data.is_public,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async remove(userId: string, playlistId: string) {
    await this.assertProRadio(userId);
    await this.getOwnedPlaylist(playlistId, userId);
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('user_playlists')
      .delete()
      .eq('id', playlistId)
      .eq('user_id', userId);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  async getTracks(userId: string, playlistId: string) {
    await this.assertProRadio(userId);
    await this.getOwnedPlaylist(playlistId, userId);
    const supabase = getSupabaseClient();
    const { data: rows, error } = await supabase
      .from('user_playlist_tracks')
      .select(
        'id, position, song_id, songs(id, title, artist_name, artist_id, artwork_url, duration_seconds, opt_in_pro_radio, product_kind, status, audio_url)',
      )
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true });
    if (error) throw new BadRequestException(error.message);

    const tracks: Array<{
      id: string;
      position: number;
      songId: string;
      title: string;
      artistName: string | null;
      artistId: string | null;
      artworkUrl: string | null;
      durationSeconds: number;
      streamUrl: string | null;
    }> = [];
    for (const row of rows ?? []) {
      const song = (row as any).songs;
      if (!song) continue;
      const streamUrl =
        song.opt_in_pro_radio === true &&
        (song.product_kind ?? 'song') !== 'beat'
          ? await signSongAudioUrl(song.audio_url ?? null)
          : null;
      tracks.push({
        id: String((row as any).id),
        position: Number((row as any).position ?? 0),
        songId: String(song.id),
        title: String(song.title ?? 'Track'),
        artistName: song.artist_name ?? null,
        artistId: song.artist_id ?? null,
        artworkUrl: song.artwork_url ?? null,
        durationSeconds: Number(song.duration_seconds ?? 0),
        streamUrl,
      });
    }
    return { tracks };
  }

  async addTrack(userId: string, playlistId: string, songId: string) {
    await this.assertProRadio(userId);
    await this.getOwnedPlaylist(playlistId, userId);
    if (!songId?.trim()) throw new BadRequestException('songId is required');
    const supabase = getSupabaseClient();
    const { data: song } = await supabase
      .from('songs')
      .select('id, opt_in_pro_radio, product_kind, status')
      .eq('id', songId)
      .maybeSingle();
    if (!song) throw new NotFoundException('Song not found');
    if (
      (song as any).product_kind === 'beat' ||
      (song as any).opt_in_pro_radio !== true
    ) {
      throw new BadRequestException(
        'This song is not available for Pro-Radio playlists',
      );
    }

    const { data: existing } = await supabase
      .from('user_playlist_tracks')
      .select('position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: false })
      .limit(1);
    const nextPos =
      existing && existing.length > 0
        ? Number(existing[0].position) + 1
        : 0;

    const { error } = await supabase.from('user_playlist_tracks').insert({
      playlist_id: playlistId,
      song_id: songId,
      position: nextPos,
    });
    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException('Song is already in this playlist');
      }
      throw new BadRequestException(error.message);
    }
    await supabase
      .from('user_playlists')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', playlistId);
    return { ok: true };
  }

  async removeTrack(userId: string, playlistId: string, songId: string) {
    await this.assertProRadio(userId);
    await this.getOwnedPlaylist(playlistId, userId);
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('user_playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('song_id', songId);
    if (error) throw new BadRequestException(error.message);
    await this.reindex(playlistId);
    return { ok: true };
  }

  async reorder(
    userId: string,
    playlistId: string,
    songIds: string[],
  ) {
    await this.assertProRadio(userId);
    await this.getOwnedPlaylist(playlistId, userId);
    if (!Array.isArray(songIds) || songIds.length === 0) {
      throw new BadRequestException('songIds required');
    }
    const supabase = getSupabaseClient();
    for (let i = 0; i < songIds.length; i++) {
      await supabase
        .from('user_playlist_tracks')
        .update({ position: i })
        .eq('playlist_id', playlistId)
        .eq('song_id', songIds[i]);
    }
    await supabase
      .from('user_playlists')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', playlistId);
    return { ok: true };
  }

  private async reindex(playlistId: string) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_playlist_tracks')
      .select('id')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true });
    let i = 0;
    for (const row of data ?? []) {
      await supabase
        .from('user_playlist_tracks')
        .update({ position: i++ })
        .eq('id', (row as { id: string }).id);
    }
  }
}
