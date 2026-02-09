import { Injectable, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { NotificationService } from '../notifications/notification.service';
import { PushNotificationService } from '../push-notifications/push-notification.service';

export interface BrowseFeedItem {
  id: string;
  type: 'image' | 'audio';
  fileUrl: string;
  title: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  provider: {
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  likeCount: number;
  bookmarkCount: number;
  liked?: boolean;
  bookmarked?: boolean;
}

export interface BrowseFeedResponse {
  items: BrowseFeedItem[];
  nextCursor: string | null;
}

@Injectable()
export class BrowseService {
  private readonly defaultLimit = 12;
  private readonly maxLimit = 30;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly pushNotification: PushNotificationService,
  ) {}

  async getFeed(
    limitInput?: number,
    cursor?: string,
    seed?: string,
    userId?: string,
  ): Promise<BrowseFeedResponse> {
    const limit = Math.min(limitInput ?? this.defaultLimit, this.maxLimit);
    const offset = cursor ? Math.max(0, parseInt(cursor, 10)) : 0;
    const supabase = getSupabaseClient();

    let query = supabase
      .from('provider_portfolio_items')
      .select(
        `
        id,
        user_id,
        type,
        file_url,
        title,
        description,
        sort_order,
        created_at,
        users (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .eq('opt_in_feed', true)
      .is('feed_removed_at', null);

    if (seed) {
      query = query.order('id'); // stable order before shuffle in app
    } else {
      query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
    }

    const { data: rows, error } = await query.range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch feed: ${error.message}`);

    const rawItems = (rows || []) as any[];
    let items = rawItems;
    if (seed && items.length > 0) {
      const hash = (s: string) => {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
        return h >>> 0;
      };
      items = [...items].sort(
        (a, b) => hash(a.id + seed) - hash(b.id + seed),
      );
    }

    const contentIds = items.map((r) => r.id);

    const [likeCounts, bookmarkCounts, userLikes, userBookmarks] = await Promise.all([
      this.getLikeCounts(supabase, contentIds),
      this.getBookmarkCounts(supabase, contentIds),
      userId ? this.getUserLikes(supabase, userId, contentIds) : Promise.resolve(new Set<string>()),
      userId ? this.getUserBookmarks(supabase, userId, contentIds) : Promise.resolve(new Set<string>()),
    ]);

    const feedItems: BrowseFeedItem[] = items.map((row) => {
      const u = row.users;
      return {
        id: row.id,
        type: row.type,
        fileUrl: row.file_url,
        title: row.title ?? null,
        description: row.description ?? null,
        sortOrder: row.sort_order ?? 0,
        createdAt: row.created_at,
        provider: {
          userId: row.user_id,
          displayName: u?.display_name ?? null,
          avatarUrl: u?.avatar_url ?? null,
        },
        likeCount: likeCounts.get(row.id) ?? 0,
        bookmarkCount: bookmarkCounts.get(row.id) ?? 0,
        liked: userId ? userLikes.has(row.id) : undefined,
        bookmarked: userId ? userBookmarks.has(row.id) : undefined,
      };
    });

    const hasMore = rawItems.length === limit;
    const nextCursor = hasMore ? String(offset + limit) : null;

    return { items: feedItems, nextCursor };
  }

  private async getLikeCounts(
    supabase: ReturnType<typeof getSupabaseClient>,
    contentIds: string[],
  ): Promise<Map<string, number>> {
    if (contentIds.length === 0) return new Map();
    const { data } = await supabase
      .from('browse_likes')
      .select('content_id')
      .in('content_id', contentIds);
    const counts = new Map<string, number>();
    for (const row of data || []) {
      counts.set(row.content_id, (counts.get(row.content_id) ?? 0) + 1);
    }
    return counts;
  }

  private async getBookmarkCounts(
    supabase: ReturnType<typeof getSupabaseClient>,
    contentIds: string[],
  ): Promise<Map<string, number>> {
    if (contentIds.length === 0) return new Map();
    const { data } = await supabase
      .from('browse_bookmarks')
      .select('content_id')
      .in('content_id', contentIds);
    const counts = new Map<string, number>();
    for (const row of data || []) {
      counts.set(row.content_id, (counts.get(row.content_id) ?? 0) + 1);
    }
    return counts;
  }

  private async getUserLikes(
    supabase: ReturnType<typeof getSupabaseClient>,
    userId: string,
    contentIds: string[],
  ): Promise<Set<string>> {
    if (contentIds.length === 0) return new Set();
    const { data } = await supabase
      .from('browse_likes')
      .select('content_id')
      .eq('user_id', userId)
      .in('content_id', contentIds);
    return new Set((data || []).map((r) => r.content_id));
  }

  private async getUserBookmarks(
    supabase: ReturnType<typeof getSupabaseClient>,
    userId: string,
    contentIds: string[],
  ): Promise<Set<string>> {
    if (contentIds.length === 0) return new Set();
    const { data } = await supabase
      .from('browse_bookmarks')
      .select('content_id')
      .eq('user_id', userId)
      .in('content_id', contentIds);
    return new Set((data || []).map((r) => r.content_id));
  }

  async toggleLike(userId: string, contentId: string): Promise<{ liked: boolean; likeCount: number }> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('browse_likes')
      .select('user_id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .maybeSingle();

    if (existing) {
      await supabase.from('browse_likes').delete().eq('user_id', userId).eq('content_id', contentId);
      const count = await this.getLikeCountForContent(supabase, contentId);
      return { liked: false, likeCount: count };
    } else {
      const item = await this.ensurePortfolioItemExistsAndReturn(supabase, contentId);
      await supabase.from('browse_likes').insert({ user_id: userId, content_id: contentId });
      const count = await this.getLikeCountForContent(supabase, contentId);
      const likerName = await this.getDisplayName(supabase, userId);
      const title = 'Content liked';
      const message = likerName
        ? `${likerName} liked your content`
        : 'Someone liked your content';
      await this.notificationService.create({
        userId: item.user_id,
        type: 'content_liked',
        title,
        message,
        metadata: { contentId, likerId: userId },
      });
      await this.pushNotification.sendPushNotification({
        userId: item.user_id,
        title,
        body: message,
        data: { type: 'content_liked', contentId },
      });
      return { liked: true, likeCount: count };
    }
  }

  async addBookmark(userId: string, contentId: string): Promise<void> {
    const supabase = getSupabaseClient();
    await this.ensurePortfolioItemExists(supabase, contentId);
    await supabase.from('browse_bookmarks').upsert(
      { user_id: userId, content_id: contentId },
      { onConflict: 'user_id,content_id' },
    );
  }

  async removeBookmark(userId: string, contentId: string): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase.from('browse_bookmarks').delete().eq('user_id', userId).eq('content_id', contentId);
  }

  async getBookmarks(userId: string, limit = 50): Promise<BrowseFeedItem[]> {
    const supabase = getSupabaseClient();
    const { data: rows } = await supabase
      .from('browse_bookmarks')
      .select(
        `
        content_id,
        provider_portfolio_items (
          id,
          user_id,
          type,
          file_url,
          title,
          description,
          sort_order,
          created_at,
          users (
            id,
            display_name,
            avatar_url
          )
        )
      `,
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const items = (rows || [])
      .map((r: any) => r.provider_portfolio_items)
      .filter(Boolean);
    if (items.length === 0) return [];

    const contentIds = items.map((i) => i.id);
    const [likeCounts, bookmarkCounts] = await Promise.all([
      this.getLikeCounts(supabase, contentIds),
      this.getBookmarkCounts(supabase, contentIds),
    ]);
    const userBookmarks = new Set(contentIds);

    return items.map((row: any) => {
      const u = row.users;
      return {
        id: row.id,
        type: row.type,
        fileUrl: row.file_url,
        title: row.title ?? null,
        description: row.description ?? null,
        sortOrder: row.sort_order ?? 0,
        createdAt: row.created_at,
        provider: {
          userId: row.user_id,
          displayName: u?.display_name ?? null,
          avatarUrl: u?.avatar_url ?? null,
        },
        likeCount: likeCounts.get(row.id) ?? 0,
        bookmarkCount: bookmarkCounts.get(row.id) ?? 0,
        liked: false,
        bookmarked: userBookmarks.has(row.id),
      };
    });
  }

  private async getLikeCountForContent(
    supabase: ReturnType<typeof getSupabaseClient>,
    contentId: string,
  ): Promise<number> {
    const { count } = await supabase
      .from('browse_likes')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', contentId);
    return count ?? 0;
  }

  private async ensurePortfolioItemExists(
    supabase: ReturnType<typeof getSupabaseClient>,
    contentId: string,
  ): Promise<void> {
    await this.ensurePortfolioItemExistsAndReturn(supabase, contentId);
  }

  private async ensurePortfolioItemExistsAndReturn(
    supabase: ReturnType<typeof getSupabaseClient>,
    contentId: string,
  ): Promise<{ id: string; user_id: string }> {
    const { data, error } = await supabase
      .from('provider_portfolio_items')
      .select('id, user_id')
      .eq('id', contentId)
      .single();
    if (error || !data) throw new NotFoundException('Content not found');
    return data as { id: string; user_id: string };
  }

  private async getDisplayName(
    supabase: ReturnType<typeof getSupabaseClient>,
    userId: string,
  ): Promise<string | null> {
    const { data } = await supabase.from('users').select('display_name').eq('id', userId).maybeSingle();
    return data?.display_name ?? null;
  }

  async reportContent(userId: string, contentId: string, reason: string): Promise<void> {
    const supabase = getSupabaseClient();
    await this.ensurePortfolioItemExists(supabase, contentId);
    const { error } = await supabase.from('browse_reports').upsert(
      { user_id: userId, content_id: contentId, reason: reason.trim().slice(0, 2000) },
      { onConflict: 'user_id,content_id' },
    );
    if (error) throw new Error(`Failed to submit report: ${error.message}`);
  }

  /** Leaderboard by category (service type) for Artist of the Week / Browse integration */
  async getLeaderboardByCategory(limitPerCategory = 5): Promise<{
    categories: Array<{ serviceType: string; items: BrowseFeedItem[] }>;
  }> {
    const supabase = getSupabaseClient();
    const { data: items } = await supabase
      .from('provider_portfolio_items')
      .select('id, user_id, type, file_url, title, description, sort_order, created_at')
      .eq('opt_in_feed', true)
      .is('feed_removed_at', null);
    if (!items?.length) return { categories: [] };

    const contentIds = items.map((r) => r.id);
    const { data: likeRows } = await supabase
      .from('browse_likes')
      .select('content_id')
      .in('content_id', contentIds);
    const likeCounts = new Map<string, number>();
    for (const row of likeRows || []) {
      likeCounts.set(row.content_id, (likeCounts.get(row.content_id) ?? 0) + 1);
    }

    const userIds = [...new Set(items.map((r) => r.user_id))];
    const { data: providers } = await supabase
      .from('service_providers')
      .select('id, user_id')
      .in('user_id', userIds);
    const providerByUserId = new Map<string, { id: string }>();
    for (const p of providers || []) providerByUserId.set(p.user_id, { id: p.id });

    const providerIds = (providers || []).map((p) => p.id);
    const { data: types } = await supabase
      .from('service_provider_types')
      .select('provider_id, service_type')
      .in('provider_id', providerIds);
    const typesByProviderId = new Map<string, string[]>();
    for (const t of types || []) {
      const list = typesByProviderId.get(t.provider_id) ?? [];
      list.push(t.service_type);
      typesByProviderId.set(t.provider_id, list);
    }

    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', userIds);
    const userMap = new Map((users || []).map((u) => [u.id, u]));

    const withLikes = items
      .map((row) => {
        const provider = providerByUserId.get(row.user_id);
        const serviceTypes = provider ? typesByProviderId.get(provider.id) ?? ['general'] : ['general'];
        const u = userMap.get(row.user_id);
        return {
          ...row,
          likeCount: likeCounts.get(row.id) ?? 0,
          serviceTypes,
          provider: { userId: row.user_id, displayName: u?.display_name ?? null, avatarUrl: u?.avatar_url ?? null },
        };
      })
      .filter((r) => r.likeCount > 0)
      .sort((a, b) => b.likeCount - a.likeCount);

    const byCategory = new Map<string, typeof withLikes>();
    for (const item of withLikes) {
      for (const st of item.serviceTypes) {
        const list = byCategory.get(st) ?? [];
        if (list.length < limitPerCategory) list.push(item);
        byCategory.set(st, list);
      }
    }

    const categories = Array.from(byCategory.entries()).map(([serviceType, list]) => ({
      serviceType,
      items: list.slice(0, limitPerCategory).map((row) => ({
        id: row.id,
        type: row.type,
        fileUrl: row.file_url,
        title: row.title ?? null,
        description: row.description ?? null,
        sortOrder: row.sort_order ?? 0,
        createdAt: row.created_at,
        provider: row.provider,
        likeCount: row.likeCount,
        bookmarkCount: 0,
      })),
    }));
    return { categories };
  }
}
