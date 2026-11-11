import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { ChatAdminService } from '../chat/chat-admin.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CONTENT_TARGET_TYPES = [
  'story',
  'post',
  'comment',
  'room_chat',
  'live_chat',
  'message',
] as const;

export type ContentTargetType = (typeof CONTENT_TARGET_TYPES)[number];

const TARGETS: Record<
  ContentTargetType,
  { table: string; author: string; preview: string }
> = {
  story: { table: 'song_stories', author: 'user_id', preview: 'caption' },
  post: { table: 'discover_feed_posts', author: 'author_user_id', preview: 'caption' },
  comment: {
    table: 'discover_feed_post_comments',
    author: 'author_user_id',
    preview: 'body',
  },
  room_chat: { table: 'chat_messages', author: 'user_id', preview: 'message' },
  live_chat: { table: 'stream_chat_messages', author: 'user_id', preview: 'message' },
  message: { table: 'service_messages', author: 'sender_id', preview: 'body' },
};

export interface ContentReportGroup {
  targetType: ContentTargetType;
  targetId: string;
  preview: string;
  author: { userId: string; displayName: string | null; username: string | null };
  reportCount: number;
  reports: Array<{
    id: string;
    reason: string;
    createdAt: string;
    reporter: { userId: string; displayName: string | null };
  }>;
}

@Injectable()
export class ModerationService {
  constructor(private readonly chatAdmin: ChatAdminService) {}

  async report(
    reporterId: string,
    targetType: string,
    targetId: string,
    reason: string,
  ): Promise<{ reported: true }> {
    const type = this.parseType(targetType);
    if (!UUID_RE.test(targetId)) {
      throw new NotFoundException('That content was not found.');
    }
    const trimmed = reason.trim().slice(0, 2000);
    if (!trimmed) throw new BadRequestException('Report reason is required');
    const target = await this.loadTarget(type, targetId);
    if (!target) throw new NotFoundException('That content was not found.');
    if (target.authorId === reporterId) {
      throw new ForbiddenException('You cannot report your own content.');
    }
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('content_reports').upsert(
      {
        reporter_user_id: reporterId,
        author_user_id: target.authorId,
        target_type: type,
        target_id: targetId,
        reason: trimmed,
        status: 'open',
      },
      { onConflict: 'reporter_user_id,target_type,target_id' },
    );
    if (error) {
      throw new BadRequestException(`Could not send that report: ${error.message}`);
    }
    return { reported: true };
  }

  async listOpen(): Promise<{ items: ContentReportGroup[] }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('content_reports')
      .select('id, reporter_user_id, author_user_id, target_type, target_id, reason, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      throw new BadRequestException(`Could not load reports: ${error.message}`);
    }
    const rows = data ?? [];
    if (rows.length === 0) return { items: [] };

    const peopleIds = [
      ...new Set(
        rows.flatMap((row) => [
          String(row.reporter_user_id),
          String(row.author_user_id),
        ]),
      ),
    ];
    const { data: people } = await supabase
      .from('users')
      .select('id, display_name, username')
      .in('id', peopleIds);
    const personById = new Map(
      (people ?? []).map((person) => [String(person.id), person]),
    );

    const groups = new Map<string, ContentReportGroup>();
    for (const row of rows) {
      const targetType = this.parseType(String(row.target_type));
      const targetId = String(row.target_id);
      const key = `${targetType}:${targetId}`;
      const author = personById.get(String(row.author_user_id));
      const reporter = personById.get(String(row.reporter_user_id));
      const group = groups.get(key) ?? {
        targetType,
        targetId,
        preview: '',
        author: {
          userId: String(row.author_user_id),
          displayName: author?.display_name ? String(author.display_name) : null,
          username: author?.username ? String(author.username) : null,
        },
        reportCount: 0,
        reports: [],
      };
      group.reports.push({
        id: String(row.id),
        reason: String(row.reason ?? ''),
        createdAt: String(row.created_at ?? ''),
        reporter: {
          userId: String(row.reporter_user_id),
          displayName: reporter?.display_name ? String(reporter.display_name) : null,
        },
      });
      group.reportCount = group.reports.length;
      groups.set(key, group);
    }

    const items = [...groups.values()];
    await Promise.all(
      items.map(async (item) => {
        const target = await this.loadTarget(item.targetType, item.targetId);
        item.preview = target?.preview || 'This content is no longer available.';
      }),
    );
    items.sort((a, b) => b.reportCount - a.reportCount);
    return { items };
  }

  async dismiss(reportId: string, adminId: string): Promise<{ ok: true }> {
    if (!UUID_RE.test(reportId)) throw new NotFoundException('Report not found');
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('content_reports')
      .update({
        status: 'dismissed',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .eq('status', 'open');
    if (error) throw new BadRequestException('Could not dismiss that report.');
    return { ok: true };
  }

  async removeTarget(reportId: string, adminId: string): Promise<{ ok: true }> {
    if (!UUID_RE.test(reportId)) throw new NotFoundException('Report not found');
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('content_reports')
      .select('id, target_type, target_id')
      .eq('id', reportId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Report not found');
    const targetType = this.parseType(String(data.target_type));
    const targetId = String(data.target_id);
    await this.deleteTarget(targetType, targetId);
    const reviewedAt = new Date().toISOString();
    await supabase
      .from('content_reports')
      .update({
        status: 'removed',
        reviewed_by: adminId,
        reviewed_at: reviewedAt,
      })
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('status', 'open');
    return { ok: true };
  }

  private parseType(value: string): ContentTargetType {
    if ((CONTENT_TARGET_TYPES as readonly string[]).includes(value)) {
      return value as ContentTargetType;
    }
    throw new BadRequestException('That content cannot be reported.');
  }

  private async loadTarget(
    type: ContentTargetType,
    id: string,
  ): Promise<{ authorId: string; preview: string } | null> {
    const spec = TARGETS[type];
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(spec.table)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    if (row.deleted_at || row.unsent_at || row.is_deleted === true) return null;
    const authorId = String(row[spec.author] ?? '');
    if (!authorId) return null;
    const preview = String(row[spec.preview] ?? '').trim().slice(0, 180);
    return { authorId, preview: preview || this.fallbackPreview(type) };
  }

  private fallbackPreview(type: ContentTargetType): string {
    switch (type) {
      case 'story':
        return 'Song story';
      case 'post':
        return 'Feed post';
      case 'comment':
        return 'Comment';
      case 'room_chat':
        return 'Radio chat message';
      case 'live_chat':
        return 'Live chat message';
      case 'message':
        return 'Direct message';
      default:
        return 'Content';
    }
  }

  private async deleteTarget(type: ContentTargetType, id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (type === 'story') {
      await this.deleteStory(id);
      return;
    }
    if (type === 'room_chat') {
      await this.chatAdmin.deleteMessage(id);
      return;
    }
    if (type === 'comment') {
      const { error } = await supabase
        .from('discover_feed_post_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new BadRequestException('Could not remove that comment.');
      return;
    }
    if (type === 'live_chat') {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('stream_chat_messages')
        .update({ is_deleted: true, deleted_at: now })
        .eq('id', id);
      if (error) throw new BadRequestException('Could not remove that message.');
      return;
    }
    if (type === 'message') {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('service_messages')
        .update({
          body: '',
          media_url: null,
          media_mime: null,
          media_duration_ms: null,
          unsent_at: now,
        })
        .eq('id', id);
      if (error) throw new BadRequestException('Could not remove that message.');
      return;
    }
    const { data: post } = await supabase
      .from('discover_feed_posts')
      .select('id, image_url')
      .eq('id', id)
      .maybeSingle();
    if (!post) throw new NotFoundException('Post not found');
    await this.removeStorageObject(String(post.image_url ?? ''));
    const { error } = await supabase.from('discover_feed_posts').delete().eq('id', id);
    if (error) throw new BadRequestException('Could not remove that post.');
  }

  private async deleteStory(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('song_stories')
      .select('id, user_id, media_url')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Story not found');
    const { error: deleteError } = await supabase
      .from('song_stories')
      .delete()
      .eq('id', id);
    if (deleteError) throw new BadRequestException('Could not remove that story.');
    const mediaUrl = String(data.media_url ?? '');
    const marker = '/feed/';
    const index = mediaUrl.indexOf(marker);
    if (index < 0) return;
    const path = decodeURIComponent(mediaUrl.slice(index + marker.length).split('?')[0]);
    const ownerId = String(data.user_id ?? '');
    if (!ownerId || !path.startsWith(`${ownerId}/`)) return;
    await supabase.storage.from('feed').remove([path]);
  }

  private async removeStorageObject(url: string): Promise<void> {
    if (!url) return;
    try {
      const path = new URL(url).pathname.match(
        /\/storage\/v1\/object\/public\/([^/]+)\/(.+)/,
      );
      if (!path) return;
      const supabase = getSupabaseClient();
      await supabase.storage.from(path[1]).remove([decodeURIComponent(path[2])]);
    } catch {
      // The row delete still removes the post from the feed.
    }
  }
}
