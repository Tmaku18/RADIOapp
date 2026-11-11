import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { UsersService } from '../users/users.service';
import { UploadsService } from '../uploads/uploads.service';
import { DurationService } from '../uploads/duration.service';

const STORY_HOURS = 24;
const MAX_STORY_SECONDS = 60;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SongStoryView {
  id: string;
  songId: string;
  mediaUrl: string;
  mediaMime: string | null;
  caption: string | null;
  visibility: 'public' | 'private' | 'hidden';
  createdAt: string;
  expiresAt: string;
  mine: boolean;
  author: {
    id: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
  };
}

@Injectable()
export class SongStoriesService {
  constructor(
    private readonly users: UsersService,
    private readonly uploads: UploadsService,
    private readonly duration: DurationService,
  ) {}

  async listForSong(songId: string, viewerId: string): Promise<SongStoryView[]> {
    if (!UUID_RE.test(songId) || !UUID_RE.test(viewerId)) return [];
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const friends = UUID_RE.test(viewerId)
      ? await this.users.getMutualFriendIds(viewerId)
      : new Set<string>();
    const visibleTo = [`visibility.eq.public`, `user_id.eq.${viewerId}`];
    if (friends.size > 0) {
      visibleTo.push(
        `and(visibility.eq.private,user_id.in.(${[...friends].join(',')}))`,
      );
    }
    const { data, error } = await supabase
      .from('song_stories')
      .select(
        'id, user_id, song_id, media_url, media_mime, caption, visibility, created_at, expires_at',
      )
      .eq('song_id', songId)
      .gt('expires_at', now)
      .or(visibleTo.join(','))
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) {
      throw new BadRequestException(`Could not load stories: ${error.message}`);
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const hidden = await this.users.getHiddenAuthorIds(viewerId);
    const visible = rows.filter((row) => {
      const authorId = String(row.user_id ?? '');
      return authorId === viewerId || !hidden.has(authorId);
    });
    const authorIds = [...new Set(visible.map((row) => String(row.user_id)))];
    const people = new Map<string, Record<string, unknown>>();
    if (authorIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, display_name, username, avatar_url')
        .in('id', authorIds);
      for (const user of users ?? []) {
        people.set(String(user.id), user as Record<string, unknown>);
      }
    }
    return visible.map((row) => this.toView(row, people, viewerId));
  }

  async create(input: {
    userId: string;
    songId: string;
    path: string;
    visibility: 'public' | 'private' | 'hidden';
    caption?: string | null;
    contentType?: string | null;
  }): Promise<SongStoryView> {
    if (!UUID_RE.test(input.songId)) {
      throw new BadRequestException('Pick a song on NetworX to post this story.');
    }
    const supabase = getSupabaseClient();
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('id')
      .eq('id', input.songId)
      .maybeSingle();
    if (songError || !song) {
      throw new BadRequestException('That song is not on NetworX.');
    }

    const { publicUrl, sizeBytes } = await this.uploads.resolveFeedUpload(
      input.userId,
      input.path,
    );
    let durationSeconds: number | null = null;
    try {
      durationSeconds = await this.duration.probeRemoteDurationSeconds(publicUrl, {
        mimeType: input.contentType?.trim() || undefined,
        sizeBytes: sizeBytes ?? undefined,
      });
    } catch {
      durationSeconds = null;
    }
    if (durationSeconds != null && durationSeconds > MAX_STORY_SECONDS + 1) {
      await this.uploads.removeFeedObject(input.path);
      throw new BadRequestException('A story has to be a minute or less.');
    }

    const caption = (input.caption ?? '').trim().slice(0, 280);
    const expiresAt = new Date(Date.now() + STORY_HOURS * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('song_stories')
      .insert({
        user_id: input.userId,
        song_id: input.songId,
        media_url: publicUrl,
        media_mime: input.contentType?.trim() || null,
        caption: caption || null,
        visibility: input.visibility,
        expires_at: expiresAt,
      })
      .select(
        'id, user_id, song_id, media_url, media_mime, caption, visibility, created_at, expires_at',
      )
      .single();
    if (error || !data) {
      throw new BadRequestException(
        `Could not post that story: ${error?.message ?? 'unknown error'}`,
      );
    }
    const people = await this.loadPeople([input.userId]);
    return this.toView(data as Record<string, unknown>, people, input.userId);
  }

  async setVisibility(
    userId: string,
    storyId: string,
    visibility: 'public' | 'private' | 'hidden',
  ): Promise<SongStoryView> {
    const row = await this.requireOwn(userId, storyId);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('song_stories')
      .update({ visibility })
      .eq('id', row.id)
      .select(
        'id, user_id, song_id, media_url, media_mime, caption, visibility, created_at, expires_at',
      )
      .single();
    if (error || !data) {
      throw new BadRequestException('Could not update that story.');
    }
    const people = await this.loadPeople([userId]);
    return this.toView(data as Record<string, unknown>, people, userId);
  }

  async remove(userId: string, storyId: string): Promise<{ ok: true }> {
    const row = await this.requireOwn(userId, storyId);
    return this.deleteRow(row, userId);
  }

  async removeAny(storyId: string): Promise<{ ok: true }> {
    if (!UUID_RE.test(storyId)) throw new NotFoundException('Story not found');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('song_stories')
      .select('id, user_id, media_url')
      .eq('id', storyId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Story not found');
    return this.deleteRow(data, String(data.user_id ?? ''));
  }

  private async deleteRow(
    row: { id: string; media_url?: string | null },
    ownerId: string,
  ): Promise<{ ok: true }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('song_stories').delete().eq('id', row.id);
    if (error) {
      throw new BadRequestException('Could not delete that story.');
    }
    const mediaUrl = String(row.media_url ?? '');
    const marker = '/feed/';
    const index = mediaUrl.indexOf(marker);
    if (index >= 0) {
      const path = decodeURIComponent(mediaUrl.slice(index + marker.length).split('?')[0]);
      if (ownerId && path.startsWith(`${ownerId}/`)) {
        await this.uploads.removeFeedObject(path);
      }
    }
    return { ok: true };
  }

  private async requireOwn(userId: string, storyId: string) {
    if (!UUID_RE.test(storyId)) throw new NotFoundException('Story not found');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('song_stories')
      .select('id, user_id, media_url')
      .eq('id', storyId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Story not found');
    if (data.user_id !== userId) {
      throw new ForbiddenException('You can only change your own story.');
    }
    return data;
  }

  private async loadPeople(ids: string[]) {
    const people = new Map<string, Record<string, unknown>>();
    if (ids.length === 0) return people;
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url')
      .in('id', ids);
    for (const user of data ?? []) {
      people.set(String(user.id), user as Record<string, unknown>);
    }
    return people;
  }

  private toView(
    row: Record<string, unknown>,
    people: Map<string, Record<string, unknown>>,
    viewerId: string,
  ): SongStoryView {
    const authorId = String(row.user_id ?? '');
    const person = people.get(authorId);
    const displayName =
      String(person?.display_name ?? '').trim() ||
      String(person?.username ?? '').trim() ||
      'Listener';
    const visibility =
      row.visibility === 'private' || row.visibility === 'hidden'
        ? row.visibility
        : 'public';
    return {
      id: String(row.id),
      songId: String(row.song_id),
      mediaUrl: String(row.media_url ?? ''),
      mediaMime: row.media_mime ? String(row.media_mime) : null,
      caption: row.caption ? String(row.caption) : null,
      visibility,
      createdAt: String(row.created_at ?? ''),
      expiresAt: String(row.expires_at ?? ''),
      mine: authorId === viewerId,
      author: {
        id: authorId,
        displayName,
        username: person?.username ? String(person.username) : null,
        avatarUrl: person?.avatar_url ? String(person.avatar_url) : null,
      },
    };
  }
}
