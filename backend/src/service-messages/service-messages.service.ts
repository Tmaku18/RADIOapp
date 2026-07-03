import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { NotificationService } from '../notifications/notification.service';
import { PushNotificationService } from '../push-notifications/push-notification.service';
import { ProNetworkSubscriptionService } from '../pro-network-subscription/pro-network-subscription.service';
import { PRO_NETWORK_PAYWALL_PAYLOAD } from '../pro-network-subscription/pro-network-subscription.constants';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { ImageModerationService } from '../moderation/image-moderation.service';

export type MessageType = 'text' | 'image' | 'video' | 'voice' | 'post_share';

export interface SharedPostSnapshot {
  id: string;
  authorUserId: string;
  authorDisplayName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  imageUrl: string;
  mediaType: 'image' | 'video';
  caption: string | null;
}

export interface ConversationSummary {
  otherUserId: string;
  otherDisplayName: string | null;
  otherAvatarUrl: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageFromMe: boolean;
  unreadCount: number;
  lastMessageType: MessageType;
  lastMessageStatus: 'sent' | 'delivered' | 'read';
  canDm: boolean;
}

export interface ServiceMessageRow {
  id: string;
  senderId: string;
  recipientId: string;
  requestId: string | null;
  body: string;
  createdAt: string;
  messageType: MessageType;
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaDurationMs: number | null;
  replyToMessageId: string | null;
  editedAt: string | null;
  unsentAt: string | null;
  status: 'sent' | 'delivered' | 'read';
  reactions: Array<{ emoji: string; userId: string; createdAt: string }>;
  sharedPostId: string | null;
  sharedPost: SharedPostSnapshot | null;
}

interface SendMessageInput {
  senderId: string;
  recipientId: string;
  body?: string;
  requestId?: string | null;
  messageType?: MessageType;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  mediaDurationMs?: number | null;
  replyToMessageId?: string | null;
  sharedPostId?: string | null;
}

@Injectable()
export class ServiceMessagesService {
  private readonly allowedDmMediaMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/webm',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/ogg',
    'audio/wav',
    'audio/x-wav',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly pushNotification: PushNotificationService,
    private readonly proNetworkSubscription: ProNetworkSubscriptionService,
    private readonly usersService: UsersService,
    private readonly imageModeration: ImageModerationService,
  ) {}

  private isMissingUserFollowsTable(error: unknown): boolean {
    const maybeError = error as { code?: string; message?: string } | null;
    const message = (maybeError?.message ?? '').toLowerCase();
    if (maybeError?.code === '42P01') {
      return (
        message.includes('user_follows') ||
        message.includes('public.user_follows')
      );
    }
    if (maybeError?.code === 'PGRST205') {
      return (
        message.includes("'public.user_follows'") ||
        message.includes("'user_follows'") ||
        message.includes('user_follows')
      );
    }
    return false;
  }

  private isMissingColumnError(error: unknown, columnName: string): boolean {
    const maybeError = error as { code?: string; message?: string } | null;
    const message = (maybeError?.message ?? '').toLowerCase();
    if (maybeError?.code === '42703') {
      return message.includes(columnName.toLowerCase());
    }
    if (maybeError?.code === 'PGRST204') {
      return (
        message.includes(`'${columnName.toLowerCase()}'`) ||
        message.includes(columnName.toLowerCase())
      );
    }
    return false;
  }

  private isMissingAnyColumnError(
    error: unknown,
    columnNames: string[],
  ): boolean {
    return columnNames.some((column) =>
      this.isMissingColumnError(error, column),
    );
  }

  private isMissingTableError(error: unknown, tableName: string): boolean {
    const maybeError = error as { code?: string; message?: string } | null;
    const message = (maybeError?.message ?? '').toLowerCase();
    const table = tableName.toLowerCase();
    if (maybeError?.code === '42P01') {
      return message.includes(table) || message.includes(`public.${table}`);
    }
    if (maybeError?.code === 'PGRST205') {
      return (
        message.includes(`'${table}'`) ||
        message.includes(`'public.${table}'`) ||
        message.includes(table)
      );
    }
    return false;
  }

  private inferSharedMediaType(url: string): 'image' | 'video' {
    const normalized = (url ?? '').toLowerCase();
    if (
      normalized.includes('.mp4') ||
      normalized.includes('.webm') ||
      normalized.includes('.mov')
    ) {
      return 'video';
    }
    return 'image';
  }

  /** Load post snapshots for shared-post messages, keyed by post id. */
  private async loadSharedPosts(
    postIds: string[],
  ): Promise<Map<string, SharedPostSnapshot>> {
    const out = new Map<string, SharedPostSnapshot>();
    const ids = [...new Set(postIds.filter(Boolean))];
    if (!ids.length) return out;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('discover_feed_posts')
      .select(
        `
        id,
        author_user_id,
        image_url,
        caption,
        users!author_user_id(display_name, username, avatar_url)
      `,
      )
      .in('id', ids);
    if (error) return out;
    for (const r of (data ?? []) as any[]) {
      const u = r.users;
      const imageUrl = r.image_url as string;
      out.set(r.id, {
        id: r.id,
        authorUserId: r.author_user_id,
        authorDisplayName: u?.display_name ?? null,
        authorUsername: u?.username ?? null,
        authorAvatarUrl: u?.avatar_url ?? null,
        imageUrl,
        mediaType: this.inferSharedMediaType(String(imageUrl ?? '')),
        caption: r.caption ?? null,
      });
    }
    return out;
  }

  /** True when the two users follow each other (mutual = "friends"). */
  private async areMutualFollowers(
    userA: string,
    userB: string,
  ): Promise<boolean> {
    if (!userA || !userB || userA === userB) return false;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_follows')
      .select('follower_user_id, followed_user_id')
      .or(
        `and(follower_user_id.eq.${userA},followed_user_id.eq.${userB}),and(follower_user_id.eq.${userB},followed_user_id.eq.${userA})`,
      );
    if (error) {
      if (this.isMissingUserFollowsTable(error)) return false;
      return false;
    }
    const rows = (data ?? []) as Array<{
      follower_user_id: string;
      followed_user_id: string;
    }>;
    const aFollowsB = rows.some(
      (r) => r.follower_user_id === userA && r.followed_user_id === userB,
    );
    const bFollowsA = rows.some(
      (r) => r.follower_user_id === userB && r.followed_user_id === userA,
    );
    return aFollowsB && bFollowsA;
  }

  async listConversations(
    userId: string,
    search?: string,
  ): Promise<ConversationSummary[]> {
    const supabase = getSupabaseClient();

    let messagesRes: any = await supabase
      .from('service_messages')
      .select(
        'id, sender_id, recipient_id, body, created_at, message_type, media_url, unsent_at, shared_post_id',
      )
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (
      messagesRes.error &&
      this.isMissingAnyColumnError(messagesRes.error, [
        'message_type',
        'media_url',
        'unsent_at',
        'shared_post_id',
      ])
    ) {
      messagesRes = await supabase
        .from('service_messages')
        .select('id, sender_id, recipient_id, body, created_at')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false });
    }
    if (messagesRes.error) {
      throw new Error(
        `Failed to load conversations: ${messagesRes.error.message}`,
      );
    }
    const messages = messagesRes.data;

    if (!messages?.length) return [];

    const otherIds = new Set<string>();
    const lastByOther = new Map<
      string,
      {
        body: string;
        created_at: string;
        fromMe: boolean;
        message_type: MessageType;
        unsent_at: string | null;
        media_url: string | null;
      }
    >();
    for (const m of messages as any[]) {
      const other = m.sender_id === userId ? m.recipient_id : m.sender_id;
      if (!lastByOther.has(other)) {
        otherIds.add(other);
        lastByOther.set(other, {
          body: m.body,
          created_at: m.created_at,
          fromMe: m.sender_id === userId,
          message_type: m.message_type ?? 'text',
          unsent_at: m.unsent_at ?? null,
          media_url: m.media_url ?? null,
        });
      }
    }

    if (otherIds.size === 0) return [];

    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', [...otherIds]);

    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    // The DM gate is now subscription-based: anyone with an active Pro
    // Networks subscription can DM anyone else. Conversations always show as
    // dm-able for the viewer when they have access. Prior versions used a
    // follow-graph here.
    const access = await this.proNetworkSubscription.getAccess(userId);
    const canDmGlobally = access.hasAccess;

    const { data: readRows, error: readError } = await supabase
      .from('message_reads')
      .select('other_user_id, last_read_at')
      .eq('user_id', userId);
    if (readError && !this.isMissingTableError(readError, 'message_reads'))
      throw new Error(`Failed to load read rows: ${readError.message}`);
    const readAtByOther = new Map<string, string | null>(
      ((readRows || []) as any[]).map((r: any) => [
        r.other_user_id,
        r.last_read_at ?? null,
      ]),
    );

    const unreadCountByOther = new Map<string, number>();
    for (const m of messages as any[]) {
      if (m.recipient_id !== userId) continue;
      const other = m.sender_id;
      const readAt = readAtByOther.get(other);
      if (
        !readAt ||
        new Date(m.created_at).getTime() > new Date(readAt).getTime()
      ) {
        unreadCountByOther.set(other, (unreadCountByOther.get(other) ?? 0) + 1);
      }
    }

    const summaries: ConversationSummary[] = [];
    for (const otherId of otherIds) {
      const last = lastByOther.get(otherId)!;
      const u = userMap.get(otherId);
      const readByOther = await this.getConversationReadAt(otherId, userId);
      const lastStatus: 'sent' | 'delivered' | 'read' =
        last.fromMe &&
        readByOther &&
        new Date(readByOther).getTime() >= new Date(last.created_at).getTime()
          ? 'read'
          : last.fromMe
            ? 'delivered'
            : 'sent';
      let preview = last.body?.slice(0, 80) ?? null;
      if (last.unsent_at) preview = 'Message unsent';
      if (last.message_type === 'post_share') {
        preview = preview ? `Shared a post: ${preview}` : 'Shared a post';
      } else if (!preview && last.media_url) {
        preview =
          last.message_type === 'image'
            ? 'Photo'
            : last.message_type === 'video'
              ? 'Video'
              : 'Voice message';
      }
      summaries.push({
        otherUserId: otherId,
        otherDisplayName: u?.display_name ?? null,
        otherAvatarUrl: u?.avatar_url ?? null,
        lastMessageAt: last.created_at,
        lastMessagePreview: preview,
        lastMessageFromMe: last.fromMe,
        unreadCount: unreadCountByOther.get(otherId) ?? 0,
        lastMessageType: last.message_type,
        lastMessageStatus: lastStatus,
        canDm: canDmGlobally,
      });
    }
    summaries.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );

    const term = (search ?? '').trim().toLowerCase();
    if (!term) return summaries;
    return summaries.filter(
      (s) =>
        (s.otherDisplayName ?? '').toLowerCase().includes(term) ||
        (s.lastMessagePreview ?? '').toLowerCase().includes(term),
    );
  }

  async getThread(
    userId: string,
    otherUserId: string,
    limit = 50,
    before?: string,
  ): Promise<ServiceMessageRow[]> {
    const supabase = getSupabaseClient();
    let q = supabase
      .from('service_messages')
      .select(
        'id, sender_id, recipient_id, request_id, body, created_at, message_type, media_url, media_mime, media_duration_ms, reply_to_message_id, edited_at, unsent_at, shared_post_id',
      )
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`,
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) q = q.lt('created_at', before);
    let threadRes: any = await q;
    if (
      threadRes.error &&
      this.isMissingAnyColumnError(threadRes.error, [
        'message_type',
        'media_url',
        'media_mime',
        'media_duration_ms',
        'reply_to_message_id',
        'edited_at',
        'unsent_at',
        'shared_post_id',
      ])
    ) {
      let legacyQ = supabase
        .from('service_messages')
        .select('id, sender_id, recipient_id, request_id, body, created_at')
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`,
        )
        .order('created_at', { ascending: false })
        .limit(limit);
      if (before) legacyQ = legacyQ.lt('created_at', before);
      threadRes = await legacyQ;
    }
    if (threadRes.error)
      throw new Error(`Failed to load thread: ${threadRes.error.message}`);
    const data = threadRes.data;

    const messageIds = (data || []).map((m: any) => m.id);
    const { data: reactionRows, error: reactionsError } = messageIds.length
      ? await supabase
          .from('message_reactions')
          .select('message_id, user_id, emoji, created_at')
          .in('message_id', messageIds)
      : { data: [], error: null as any };
    if (
      reactionsError &&
      !this.isMissingTableError(reactionsError, 'message_reactions')
    ) {
      throw new Error(
        `Failed to load message reactions: ${reactionsError.message}`,
      );
    }
    const reactionsByMessage = new Map<
      string,
      Array<{ emoji: string; userId: string; createdAt: string }>
    >();
    for (const r of (reactionRows || []) as any[]) {
      const key = r.message_id as string;
      const list = reactionsByMessage.get(key) ?? [];
      list.push({
        emoji: r.emoji,
        userId: r.user_id,
        createdAt: r.created_at,
      });
      reactionsByMessage.set(key, list);
    }

    const sharedPostIds = (data || [])
      .map((m: any) => m.shared_post_id)
      .filter(Boolean) as string[];
    const sharedPosts = await this.loadSharedPosts(sharedPostIds);

    const readAt = await this.getConversationReadAt(otherUserId, userId);
    const rows: ServiceMessageRow[] = (data || []).map((m: any) => ({
      id: m.id,
      senderId: m.sender_id,
      recipientId: m.recipient_id,
      requestId: m.request_id,
      body: m.body,
      createdAt: m.created_at,
      messageType: (m.message_type ?? 'text') as MessageType,
      mediaUrl: m.media_url ?? null,
      mediaMime: m.media_mime ?? null,
      mediaDurationMs: m.media_duration_ms ?? null,
      replyToMessageId: m.reply_to_message_id ?? null,
      editedAt: m.edited_at ?? null,
      unsentAt: m.unsent_at ?? null,
      status:
        m.sender_id === userId
          ? readAt &&
            new Date(readAt).getTime() >= new Date(m.created_at).getTime()
            ? ('read' as const)
            : ('delivered' as const)
          : ('sent' as const),
      reactions: reactionsByMessage.get(m.id) ?? [],
      sharedPostId: m.shared_post_id ?? null,
      sharedPost: m.shared_post_id
        ? (sharedPosts.get(m.shared_post_id) ?? null)
        : null,
    }));
    return rows.reverse();
  }

  async sendMessage(input: SendMessageInput): Promise<ServiceMessageRow> {
    const messageType = input.messageType ?? 'text';
    const trimmedBody = (input.body ?? '').trim();
    if (messageType === 'text' && !trimmedBody) {
      throw new BadRequestException('Text messages require body');
    }
    if (
      messageType !== 'text' &&
      messageType !== 'post_share' &&
      !input.mediaUrl
    ) {
      throw new BadRequestException('Media messages require mediaUrl');
    }
    if (messageType === 'post_share' && !input.sharedPostId) {
      throw new BadRequestException('Shared post messages require sharedPostId');
    }
    if (input.senderId === input.recipientId) {
      throw new BadRequestException('Cannot message yourself');
    }
    if (
      await this.usersService.areUsersBlocked(
        input.senderId,
        input.recipientId,
      )
    ) {
      throw new ForbiddenException('You cannot message this user.');
    }

    // DM pictures upload directly to storage via signed URLs, so screen them
    // for privacy-policy violations before the message is persisted.
    if (messageType === 'image' && input.mediaUrl) {
      await this.imageModeration.assertImageUrlAllowed(
        input.mediaUrl,
        'Picture',
      );
    }

    // Validate the shared post exists up front so we don't persist a dangling
    // reference (and so we can deliver the snapshot in the response).
    let sharedPostSnapshot: SharedPostSnapshot | null = null;
    if (messageType === 'post_share' && input.sharedPostId) {
      const snapshots = await this.loadSharedPosts([input.sharedPostId]);
      sharedPostSnapshot = snapshots.get(input.sharedPostId) ?? null;
      if (!sharedPostSnapshot) {
        throw new NotFoundException('Shared post not found');
      }
    }

    // DM gate: Pro Networks subscription is normally required. Exception:
    // sharing a post to a friend (mutual follower) is always allowed so the
    // social share-to-friends flow works without a subscription.
    const access = await this.proNetworkSubscription.getAccess(input.senderId);
    if (!access.hasAccess) {
      const sharingToFriend =
        messageType === 'post_share' &&
        (await this.areMutualFollowers(input.senderId, input.recipientId));
      if (!sharingToFriend) {
        throw new ForbiddenException(PRO_NETWORK_PAYWALL_PAYLOAD);
      }
    }

    const supabase = getSupabaseClient();
    let insertRes = await supabase
      .from('service_messages')
      .insert({
        sender_id: input.senderId,
        recipient_id: input.recipientId,
        request_id: input.requestId ?? null,
        body: trimmedBody,
        message_type: messageType,
        media_url: input.mediaUrl ?? null,
        media_mime: input.mediaMime ?? null,
        media_duration_ms: input.mediaDurationMs ?? null,
        reply_to_message_id: input.replyToMessageId ?? null,
        shared_post_id: input.sharedPostId ?? null,
      })
      .select(
        'id, sender_id, recipient_id, request_id, body, created_at, message_type, media_url, media_mime, media_duration_ms, reply_to_message_id, edited_at, unsent_at, shared_post_id',
      )
      .single();
    if (
      insertRes.error &&
      this.isMissingAnyColumnError(insertRes.error, [
        'message_type',
        'media_url',
        'media_mime',
        'media_duration_ms',
        'reply_to_message_id',
        'shared_post_id',
      ])
    ) {
      insertRes = await supabase
        .from('service_messages')
        .insert({
          sender_id: input.senderId,
          recipient_id: input.recipientId,
          request_id: input.requestId ?? null,
          body: trimmedBody,
        })
        .select('id, sender_id, recipient_id, request_id, body, created_at')
        .single();
    }

    if (insertRes.error) {
      throw new Error(`Failed to send message: ${insertRes.error.message}`);
    }
    const inserted = insertRes.data as any;

    const msg: ServiceMessageRow = {
      id: inserted.id,
      senderId: inserted.sender_id,
      recipientId: inserted.recipient_id,
      requestId: inserted.request_id,
      body: inserted.body,
      createdAt: inserted.created_at,
      messageType: (inserted.message_type ?? 'text') as MessageType,
      mediaUrl: inserted.media_url ?? null,
      mediaMime: inserted.media_mime ?? null,
      mediaDurationMs: inserted.media_duration_ms ?? null,
      replyToMessageId: inserted.reply_to_message_id ?? null,
      editedAt: inserted.edited_at ?? null,
      unsentAt: inserted.unsent_at ?? null,
      status: 'delivered' as const,
      reactions: [],
      sharedPostId: inserted.shared_post_id ?? input.sharedPostId ?? null,
      sharedPost: sharedPostSnapshot,
    };

    const senderName = await this.getDisplayName(input.senderId);
    const title = 'New message';
    const fallbackPreview =
      messageType === 'text'
        ? trimmedBody
        : messageType === 'image'
          ? 'Sent a photo'
          : messageType === 'video'
            ? 'Sent a video'
            : messageType === 'post_share'
              ? 'Shared a post'
              : 'Sent a voice message';
    const messageText = senderName
      ? `${senderName}: ${fallbackPreview.slice(0, 60)}${fallbackPreview.length > 60 ? '…' : ''}`
      : fallbackPreview.slice(0, 80);

    await this.notificationService.create({
      userId: input.recipientId,
      type: 'new_message',
      title,
      message: messageText,
      metadata: {
        senderId: input.senderId,
        messageId: inserted.id,
        requestId: inserted.request_id,
      },
    });

    await this.pushNotification.sendPushNotification({
      userId: input.recipientId,
      title,
      body: messageText,
      data: {
        type: 'new_message',
        senderId: input.senderId,
        messageId: inserted.id,
      },
    });

    return msg;
  }

  async editMessage(
    userId: string,
    messageId: string,
    newBody: string,
  ): Promise<{ ok: true; editedAt: string }> {
    const supabase = getSupabaseClient();
    const { data: message, error: findError } = await supabase
      .from('service_messages')
      .select('id, sender_id, created_at, unsent_at, message_type')
      .eq('id', messageId)
      .single();
    if (findError || !message) throw new NotFoundException('Message not found');
    if (message.sender_id !== userId) {
      throw new ForbiddenException('Only sender can edit message');
    }
    if (message.unsent_at) {
      throw new BadRequestException('Cannot edit unsent message');
    }
    if ((message.message_type ?? 'text') !== 'text') {
      throw new BadRequestException('Only text messages can be edited');
    }
    const fifteenMinutesMs = 15 * 60 * 1000;
    if (
      Date.now() - new Date(message.created_at).getTime() >
      fifteenMinutesMs
    ) {
      throw new BadRequestException('Edit window expired');
    }
    const editedAt = new Date().toISOString();
    const { error } = await supabase
      .from('service_messages')
      .update({ body: newBody.trim(), edited_at: editedAt })
      .eq('id', messageId)
      .eq('sender_id', userId);
    if (error) throw new Error(`Failed to edit message: ${error.message}`);
    return { ok: true, editedAt };
  }

  async unsendMessage(
    userId: string,
    messageId: string,
  ): Promise<{ ok: true; unsentAt: string }> {
    const supabase = getSupabaseClient();
    const { data: message, error: findError } = await supabase
      .from('service_messages')
      .select('id, sender_id, unsent_at')
      .eq('id', messageId)
      .single();
    if (findError || !message) throw new NotFoundException('Message not found');
    if (message.sender_id !== userId) {
      throw new ForbiddenException('Only sender can unsend message');
    }
    if (message.unsent_at) {
      return { ok: true, unsentAt: message.unsent_at };
    }
    const unsentAt = new Date().toISOString();
    const { error } = await supabase
      .from('service_messages')
      .update({
        body: '',
        media_url: null,
        media_mime: null,
        media_duration_ms: null,
        unsent_at: unsentAt,
      })
      .eq('id', messageId)
      .eq('sender_id', userId);
    if (error) throw new Error(`Failed to unsend message: ${error.message}`);
    return { ok: true, unsentAt };
  }

  async addReaction(
    userId: string,
    messageId: string,
    emoji: string,
  ): Promise<{ ok: true }> {
    const supabase = getSupabaseClient();
    await this.ensureParticipant(messageId, userId);
    const { error } = await supabase.from('message_reactions').upsert(
      {
        message_id: messageId,
        user_id: userId,
        emoji,
      },
      { onConflict: 'message_id,user_id,emoji', ignoreDuplicates: true },
    );
    if (error) throw new Error(`Failed to add reaction: ${error.message}`);
    return { ok: true };
  }

  async removeReaction(
    userId: string,
    messageId: string,
    emoji: string,
  ): Promise<{ ok: true }> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
    if (error) throw new Error(`Failed to remove reaction: ${error.message}`);
    return { ok: true };
  }

  async markThreadRead(
    userId: string,
    otherUserId: string,
    lastReadMessageId?: string | null,
  ): Promise<{
    ok: true;
    lastReadAt: string;
    lastReadMessageId: string | null;
  }> {
    const supabase = getSupabaseClient();
    let resolvedLastReadMessageId = lastReadMessageId ?? null;
    if (!resolvedLastReadMessageId) {
      const { data: latest } = await supabase
        .from('service_messages')
        .select('id')
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`,
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedLastReadMessageId = latest?.id ?? null;
    }

    const lastReadAt = new Date().toISOString();
    const { error } = await supabase.from('message_reads').upsert(
      {
        user_id: userId,
        other_user_id: otherUserId,
        last_read_message_id: resolvedLastReadMessageId,
        last_read_at: lastReadAt,
        updated_at: lastReadAt,
      },
      { onConflict: 'user_id,other_user_id' },
    );
    if (error && !this.isMissingTableError(error, 'message_reads')) {
      throw new Error(`Failed to mark thread read: ${error.message}`);
    }
    return {
      ok: true,
      lastReadAt,
      lastReadMessageId: resolvedLastReadMessageId,
    };
  }

  async getUnreadSummary(userId: string): Promise<{
    totalUnread: number;
    byConversation: Array<{ otherUserId: string; unreadCount: number }>;
  }> {
    const conversations = await this.listConversations(userId);
    const byConversation = conversations
      .filter((c) => c.unreadCount > 0)
      .map((c) => ({ otherUserId: c.otherUserId, unreadCount: c.unreadCount }));
    return {
      totalUnread: byConversation.reduce(
        (sum, row) => sum + row.unreadCount,
        0,
      ),
      byConversation,
    };
  }

  async typingHeartbeat(
    userId: string,
    otherUserId: string,
  ): Promise<{ ok: true; fromUserId: string; toUserId: string; at: string }> {
    return {
      ok: true,
      fromUserId: userId,
      toUserId: otherUserId,
      at: new Date().toISOString(),
    };
  }

  async getMediaUploadUrl(
    userId: string,
    filename: string,
    contentType: string,
  ): Promise<{ signedUrl: string; path: string; expiresIn: number }> {
    if (!this.allowedDmMediaMimeTypes.includes(contentType)) {
      throw new BadRequestException('Unsupported DM media type');
    }
    const extension = filename.split('.').pop() || 'bin';
    const path = `${userId}/${Date.now()}-${randomUUID()}.${extension}`;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from('dm-media')
      .createSignedUploadUrl(path);
    if (error) {
      throw new BadRequestException(
        `Failed to generate upload URL: ${error.message}`,
      );
    }
    const supabaseUrl = (
      this.configService.get<string>('SUPABASE_URL') || ''
    ).trim();
    const normalizedBase = supabaseUrl.endsWith('/')
      ? supabaseUrl.slice(0, -1)
      : supabaseUrl;
    const normalizedSignedUrl = data.signedUrl.startsWith('http')
      ? data.signedUrl
      : `${normalizedBase}${data.signedUrl.startsWith('/') ? '' : '/'}${data.signedUrl}`;

    return {
      signedUrl: normalizedSignedUrl,
      path: data.path,
      expiresIn: 60,
    };
  }

  private async ensureParticipant(
    messageId: string,
    userId: string,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: msg, error } = await supabase
      .from('service_messages')
      .select('sender_id, recipient_id')
      .eq('id', messageId)
      .single();
    if (error || !msg) throw new NotFoundException('Message not found');
    if (msg.sender_id !== userId && msg.recipient_id !== userId) {
      throw new ForbiddenException('Not a participant in this thread');
    }
  }

  private async getConversationReadAt(
    userId: string,
    otherUserId: string,
  ): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('message_reads')
      .select('last_read_at')
      .eq('user_id', userId)
      .eq('other_user_id', otherUserId)
      .maybeSingle();
    if (error && !this.isMissingTableError(error, 'message_reads')) {
      throw new Error(`Failed to load read marker: ${error.message}`);
    }
    return data?.last_read_at ?? null;
  }

  private async getDisplayName(userId: string): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    return data?.display_name ?? null;
  }

  /**
   * Subscription-based DM gate. Replaces the previous follow-graph check; the
   * legacy helper is kept as a thin wrapper for any caller that imported it.
   */
  async canSendDm(senderId: string, _recipientId: string): Promise<boolean> {
    void _recipientId;
    const access = await this.proNetworkSubscription.getAccess(senderId);
    return access.hasAccess;
  }
}
