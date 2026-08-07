import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

const RELEASE_TYPES = ['single', 'ep', 'album', 'mixtape'] as const;
export type AlbumReleaseType = (typeof RELEASE_TYPES)[number];

@Injectable()
export class AlbumsService {
  private mapAlbum(row: {
    id: string;
    title: string;
    release_type: string;
    artwork_url: string | null;
    release_date: string | null;
    created_at: string;
    updated_at: string;
    trackCount?: number;
  }) {
    return {
      id: row.id,
      title: row.title,
      releaseType: row.release_type,
      artworkUrl: row.artwork_url,
      releaseDate: row.release_date,
      trackCount: row.trackCount ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async getOwnedAlbum(albumId: string, artistId: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .eq('id', albumId)
      .eq('artist_id', artistId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Album not found');
    return data;
  }

  async listMine(artistId: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('albums')
      .select(
        'id, title, release_type, artwork_url, release_date, created_at, updated_at',
      )
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false });
    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('albums') || msg.includes('does not exist')) {
        return { albums: [] };
      }
      throw new BadRequestException(msg);
    }
    const albums = data ?? [];
    const counts = new Map<string, number>();
    if (albums.length > 0) {
      const { data: tracks } = await supabase
        .from('songs')
        .select('album_id')
        .in(
          'album_id',
          albums.map((a) => a.id),
        )
        .eq('artist_id', artistId);
      for (const row of tracks ?? []) {
        const id = (row as { album_id: string }).album_id;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return {
      albums: albums.map((a) =>
        this.mapAlbum({ ...a, trackCount: counts.get(a.id) ?? 0 }),
      ),
    };
  }

  async create(
    artistId: string,
    body: {
      title: string;
      releaseType?: string;
      artworkUrl?: string | null;
      releaseDate?: string | null;
    },
  ) {
    const title = (body.title ?? '').trim();
    if (!title) throw new BadRequestException('Title is required');
    const releaseType = (body.releaseType ?? 'album').toLowerCase();
    if (!RELEASE_TYPES.includes(releaseType as AlbumReleaseType)) {
      throw new BadRequestException(
        `releaseType must be one of: ${RELEASE_TYPES.join(', ')}`,
      );
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('albums')
      .insert({
        artist_id: artistId,
        title,
        release_type: releaseType,
        artwork_url: body.artworkUrl?.trim() || null,
        release_date: body.releaseDate?.trim() || null,
      })
      .select(
        'id, title, release_type, artwork_url, release_date, created_at, updated_at',
      )
      .single();
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Failed to create album');
    }
    return this.mapAlbum({ ...data, trackCount: 0 });
  }

  async update(
    artistId: string,
    albumId: string,
    body: {
      title?: string;
      releaseType?: string;
      artworkUrl?: string | null;
      releaseDate?: string | null;
    },
  ) {
    await this.getOwnedAlbum(albumId, artistId);
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) throw new BadRequestException('Title cannot be empty');
      update.title = title;
    }
    if (body.releaseType !== undefined) {
      const releaseType = body.releaseType.toLowerCase();
      if (!RELEASE_TYPES.includes(releaseType as AlbumReleaseType)) {
        throw new BadRequestException(
          `releaseType must be one of: ${RELEASE_TYPES.join(', ')}`,
        );
      }
      update.release_type = releaseType;
    }
    if (body.artworkUrl !== undefined) {
      update.artwork_url = body.artworkUrl?.trim() || null;
    }
    if (body.releaseDate !== undefined) {
      update.release_date = body.releaseDate?.trim() || null;
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('albums')
      .update(update)
      .eq('id', albumId)
      .eq('artist_id', artistId)
      .select(
        'id, title, release_type, artwork_url, release_date, created_at, updated_at',
      )
      .single();
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Failed to update album');
    }
    const { count } = await supabase
      .from('songs')
      .select('id', { count: 'exact', head: true })
      .eq('album_id', albumId);
    return this.mapAlbum({ ...data, trackCount: count ?? 0 });
  }

  async remove(artistId: string, albumId: string) {
    await this.getOwnedAlbum(albumId, artistId);
    const supabase = getSupabaseClient();
    // ON DELETE SET NULL clears song.album_id; delete album row.
    const { error } = await supabase
      .from('albums')
      .delete()
      .eq('id', albumId)
      .eq('artist_id', artistId);
    if (error) throw new BadRequestException(error.message);
    return { ok: true as const };
  }

  /** Replace album membership and track order. */
  async setTracks(artistId: string, albumId: string, songIds: string[]) {
    await this.getOwnedAlbum(albumId, artistId);
    const ids = [...new Set((songIds ?? []).map((id) => id.trim()).filter(Boolean))];
    const supabase = getSupabaseClient();

    if (ids.length > 0) {
      const { data: owned, error } = await supabase
        .from('songs')
        .select('id')
        .eq('artist_id', artistId)
        .in('id', ids);
      if (error) throw new BadRequestException(error.message);
      const ownedIds = new Set((owned ?? []).map((s) => s.id as string));
      const missing = ids.filter((id) => !ownedIds.has(id));
      if (missing.length > 0) {
        throw new ForbiddenException(
          'You can only add your own songs to an album',
        );
      }
    }

    // Clear existing membership for this album.
    const { error: clearError } = await supabase
      .from('songs')
      .update({ album_id: null, track_number: null, updated_at: new Date().toISOString() })
      .eq('album_id', albumId)
      .eq('artist_id', artistId);
    if (clearError) throw new BadRequestException(clearError.message);

    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from('songs')
        .update({
          album_id: albumId,
          track_number: i + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ids[i])
        .eq('artist_id', artistId);
      if (error) throw new BadRequestException(error.message);
    }

    // Prefer album artwork from the first track when unset.
    if (ids.length > 0) {
      const { data: album } = await supabase
        .from('albums')
        .select('artwork_url')
        .eq('id', albumId)
        .maybeSingle();
      if (album && !album.artwork_url) {
        const { data: first } = await supabase
          .from('songs')
          .select('artwork_url')
          .eq('id', ids[0])
          .maybeSingle();
        if (first?.artwork_url) {
          await supabase
            .from('albums')
            .update({
              artwork_url: first.artwork_url,
              updated_at: new Date().toISOString(),
            })
            .eq('id', albumId);
        }
      }
    }

    return { ok: true as const, trackCount: ids.length };
  }

  async addTrack(artistId: string, albumId: string, songId: string) {
    await this.getOwnedAlbum(albumId, artistId);
    const supabase = getSupabaseClient();
    const { data: song, error } = await supabase
      .from('songs')
      .select('id, artist_id, album_id')
      .eq('id', songId)
      .maybeSingle();
    if (error || !song) throw new NotFoundException('Song not found');
    if (song.artist_id !== artistId) {
      throw new ForbiddenException('You can only add your own songs to an album');
    }
    const { count } = await supabase
      .from('songs')
      .select('id', { count: 'exact', head: true })
      .eq('album_id', albumId);
    const nextNumber = (count ?? 0) + 1;
    const { error: updateError } = await supabase
      .from('songs')
      .update({
        album_id: albumId,
        track_number: nextNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', songId);
    if (updateError) throw new BadRequestException(updateError.message);
    return { ok: true as const, trackNumber: nextNumber };
  }

  async removeTrack(artistId: string, albumId: string, songId: string) {
    await this.getOwnedAlbum(albumId, artistId);
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('songs')
      .update({
        album_id: null,
        track_number: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', songId)
      .eq('album_id', albumId)
      .eq('artist_id', artistId);
    if (error) throw new BadRequestException(error.message);

    // Re-number remaining tracks.
    const { data: remaining } = await supabase
      .from('songs')
      .select('id')
      .eq('album_id', albumId)
      .eq('artist_id', artistId)
      .order('track_number', { ascending: true });
    for (let i = 0; i < (remaining ?? []).length; i++) {
      await supabase
        .from('songs')
        .update({ track_number: i + 1 })
        .eq('id', remaining![i].id);
    }
    return { ok: true as const };
  }
}
