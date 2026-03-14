import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { NotificationService } from '../notifications/notification.service';
import { PushNotificationService } from '../push-notifications/push-notification.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface ConversationSummary {
  otherUserId: string;
  otherDisplayName: string | null;
  otherAvatarUrl: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageFromMe: boolean;
  unreadCount: number;
  lastMessageType: 'text' | 'image' | 'video' | 'voice';
  lastMessageStatus: 'sent' | 'delivered' | 'read';
}

export interface ServiceMessageRow {
  id: string;
  senderId: string;
  recipientId: string;
  requestId: string | null;
  body: string;
  createdAt: string;
  messageType: 'text' | 'image' | 'video' | 'voice';
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaDurationMs: number | null;
  replyToMessageId: string | null;
  editedAt: string | null;
  unsentAt: string | null;
  status: 'sent' | 'delivered' | 'read';
  reactions: Array<{ emoji: string; userId: string; createdAt: string }>;
}

interface SendMessageInput {
  senderId: string;
  recipientId: string;
  body?: string;
  requestId?: string | null;
  messageType?: 'text' | 'image' | 'video' | 'voice';
  mediaUrl?: string | null;
  mediaMime?: string | null;
  mediaDurationMs?: number | null;
  replyToMessageId?: string | null;
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
  ) {}

  async listConversations(
    userId: string,
    search?: string,
  ): Promise<ConversationSummary[]> {
    const supabase = getSupabaseClient();

    const { data: messages, error } = await supabase
      .from('service_messages')
      .select(
        'id, sender_id, recipient_id, body, created_at, message_type, media_url, unsent_at',
      )
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load conversations: ${error.message}`);

    if (!messages?.length) return [];

    const otherIds = new Set<string>();
    const lastByOther = new Map<
      string,
      {
        body: string;
        created_at: string;
        fromMe: boolean;
        message_type: 'text' | 'image' | 'video' | 'voice';
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

    const { data: readRows, error: readError } = await supabase
      .from('message_reads')
      .select('other_user_id, last_read_at')
      .eq('user_id', userId);
    if (readError) throw new Error(`Failed to load read rows: ${readError.message}`);
    const readAtByOther = new Map<string, string | null>(
      (readRows || []).map((r: any) => [r.other_user_id, r.last_read_at ?? null]),
    );

    const unreadCountByOther = new Map<string, number>();
    for (const m of messages as any[]) {
      if (m.recipient_id !== userId) continue;
      const other = m.sender_id;
      const readAt = readAtByOther.get(other);
      if (!readAt || new Date(m.created_at).getTime() > new Date(readAt).getTime()) {
        unreadCountByOther.set(other, (unreadCountByOther.get(other) ?? 0) + 1);
      }
    }

    const summaries: ConversationSummary[] = [];
    for (const otherId of otherIds) {
      const last = lastByOther.get(otherId)!;
      const u = userMap.get(otherId);
      const readByOther = await this.getConversationReadAt(otherId, userId);
      const lastStatus: 'sent' | 'delivered' | 'read' =
        last.fromMe && readByOther && new Date(readByOther).getTime() >= new Date(last.created_at).getTime()
          ? 'read'
          : last.fromMe
            ? 'delivered'
            : 'sent';
      let preview = last.body?.slice(0, 80) ?? null;
      if (last.unsent_at) preview = 'Message unsent';
      if (!preview && last.media_url) {
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
      });
    }
    summaries.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

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
        'id, sender_id, recipient_id, request_id, body, created_at, message_type, media_url, media_mime, media_duration_ms, reply_to_message_id, edited_at, unsent_at',
      )
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q;
    if (error) throw new Error(`Failed to load thread: ${error.message}`);

    const messageIds = (data || []).map((m: any) => m.id);
    const { data: reactionRows, error: reactionsError } = messageIds.length
      ? await supabase
          .from('message_reactions')
          .select('message_id, user_id, emoji, created_at')
          .in('message_id', messageIds)
      : { data: [], error: null as any };
    if (reactionsError) {
      throw new Error(`Failed to load message reactions: ${reactionsError.message}`);
    }
    const reactionsByMessage = new Map<
      string,
      Array<{ emoji: string; userId: string; createdAt: string }>
    >();
    for (const r of reactionRows || []) {
      const key = (r as any).message_id as string;
      const list = reactionsByMessage.get(key) ?? [];
      list.push({
        emoji: (r as any).emoji,
        userId: (r as any).user_id,
        createdAt: (r as any).created_at,
      });
      reactionsByMessage.set(key, list);
    }

    const readAt = await this.getConversationReadAt(otherUserId, userId);
    const rows = (data || []).map((m: any) => ({
      id: m.id,
      senderId: m.sender_id,
      recipientId: m.recipient_id,
      requestId: m.request_id,
      body: m.body,
      createdAt: m.created_at,
      messageType: (m.message_type ?? 'text') as 'text' | 'image' | 'video' | 'voice',
      mediaUrl: m.media_url ?? null,
      mediaMime: m.media_mime ?? null,
      mediaDurationMs: m.media_duration_ms ?? null,
      replyToMessageId: m.reply_to_message_id ?? null,
      editedAt: m.edited_at ?? null,
      unsentAt: m.unsent_at ?? null,
      status:
        m.sender_id === userId
          ? readAt && new Date(readAt).getTime() >= new Date(m.created_at).getTime()
            ? ('read' as const)
            : ('delivered' as const)
          : ('sent' as const),
      reactions: reactionsByMessage.get(m.id) ?? [],
    }));
    return rows.reverse();
  }

  async sendMessage(input: SendMessageInput): Promise<ServiceMessageRow> {
    const messageType = input.messageType ?? 'text';
    const trimmedBody = (input.body ?? '').trim();
    if (messageType === 'text' && !trimmedBody) {
      throw new BadRequestException('Text messages require body');
    }
    if (messageType !== 'text' && !input.mediaUrl) {
      throw new BadRequestException('Media messages require mediaUrl');
    }
    if (input.senderId === input.recipientId) {
      throw new BadRequestException('Cannot message yourself');
    }

    const supabase = getSupabaseClient();
    const { data: inserted, error } = await supabase
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
      })
      .select(
        'id, sender_id, recipient_id, request_id, body, created_at, message_type, media_url, media_mime, media_duration_ms, reply_to_message_id, edited_at, unsent_at',
      )
      .single();

    if (error) throw new Error(`Failed to send message: ${error.message}`);

    const msg = {
      id: inserted.id,
      senderId: inserted.sender_id,
      recipientId: inserted.recipient_id,
      requestId: inserted.request_id,
      body: inserted.body,
      createdAt: inserted.created_at,
      messageType: inserted.message_type,
      mediaUrl: inserted.media_url,
      mediaMime: inserted.media_mime,
      mediaDurationMs: inserted.media_duration_ms,
      replyToMessageId: inserted.reply_to_message_id,
      editedAt: inserted.edited_at ?? null,
      unsentAt: inserted.unsent_at ?? null,
      status: 'delivered' as const,
      reactions: [],
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
      data: { type: 'new_message', senderId: input.senderId, messageId: inserted.id },
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
    if (Date.now() - new Date(message.created_at).getTime() > fifteenMinutesMs) {
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
  ): Promise<{ ok: true; lastReadAt: string; lastReadMessageId: string | null }> {
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
    if (error) throw new Error(`Failed to mark thread read: ${error.message}`);
    return {
      ok: true,
      lastReadAt,
      lastReadMessageId: resolvedLastReadMessageId,
    };
  }

  async getUnreadSummary(
    userId: string,
  ): Promise<{ totalUnread: number; byConversation: Array<{ otherUserId: string; unreadCount: number }> }> {
    const conversations = await this.listConversations(userId);
    const byConversation = conversations
      .filter((c) => c.unreadCount > 0)
      .map((c) => ({ otherUserId: c.otherUserId, unreadCount: c.unreadCount }));
    return {
      totalUnread: byConversation.reduce((sum, row) => sum + row.unreadCount, 0),
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
      throw new BadRequestException(`Failed to generate upload URL: ${error.message}`);
    }
    const supabaseUrl = (this.configService.get<string>('SUPABASE_URL') || '').trim();
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

  private async ensureParticipant(messageId: string, userId: string): Promise<void> {
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
    const { data } = await supabase
      .from('message_reads')
      .select('last_read_at')
      .eq('user_id', userId)
      .eq('other_user_id', otherUserId)
      .maybeSingle();
    return data?.last_read_at ?? null;
  }

  private async getDisplayName(userId: string): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('users').select('display_name').eq('id', userId).maybeSingle();
    return data?.display_name ?? null;
  }
}
