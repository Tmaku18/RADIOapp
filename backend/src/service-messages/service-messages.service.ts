import { Injectable, ForbiddenException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { CreatorNetworkService } from '../creator-network/creator-network.service';
import { NotificationService } from '../notifications/notification.service';
import { PushNotificationService } from '../push-notifications/push-notification.service';

export interface ConversationSummary {
  otherUserId: string;
  otherDisplayName: string | null;
  otherAvatarUrl: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageFromMe: boolean;
  unreadCount?: number;
}

export interface ServiceMessageRow {
  id: string;
  senderId: string;
  recipientId: string;
  requestId: string | null;
  body: string;
  createdAt: string;
}

@Injectable()
export class ServiceMessagesService {
  constructor(
    private readonly creatorNetwork: CreatorNetworkService,
    private readonly notificationService: NotificationService,
    private readonly pushNotification: PushNotificationService,
  ) {}

  async listConversations(userId: string): Promise<ConversationSummary[]> {
    const supabase = getSupabaseClient();

    const { data: messages } = await supabase
      .from('service_messages')
      .select('id, sender_id, recipient_id, body, created_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (!messages?.length) return [];

    const otherIds = new Set<string>();
    const lastByOther = new Map<string, { body: string; created_at: string; fromMe: boolean }>();
    for (const m of messages as any[]) {
      const other = m.sender_id === userId ? m.recipient_id : m.sender_id;
      if (!lastByOther.has(other)) {
        otherIds.add(other);
        lastByOther.set(other, {
          body: m.body,
          created_at: m.created_at,
          fromMe: m.sender_id === userId,
        });
      }
    }

    if (otherIds.size === 0) return [];

    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', [...otherIds]);

    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    const summaries: ConversationSummary[] = [];
    for (const otherId of otherIds) {
      const last = lastByOther.get(otherId)!;
      const u = userMap.get(otherId);
      summaries.push({
        otherUserId: otherId,
        otherDisplayName: u?.display_name ?? null,
        otherAvatarUrl: u?.avatar_url ?? null,
        lastMessageAt: last.created_at,
        lastMessagePreview: last.body?.slice(0, 80) ?? null,
        lastMessageFromMe: last.fromMe,
      });
    }
    summaries.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    return summaries;
  }

  async getThread(userId: string, otherUserId: string, limit = 50, before?: string): Promise<ServiceMessageRow[]> {
    const supabase = getSupabaseClient();
    let q = supabase
      .from('service_messages')
      .select('id, sender_id, recipient_id, request_id, body, created_at')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) q = q.lt('created_at', before);
    const { data } = await q;
    const rows = (data || []).map((m: any) => ({
      id: m.id,
      senderId: m.sender_id,
      recipientId: m.recipient_id,
      requestId: m.request_id,
      body: m.body,
      createdAt: m.created_at,
    }));
    return rows.reverse();
  }

  async sendMessage(
    senderId: string,
    recipientId: string,
    body: string,
    requestId?: string | null,
  ): Promise<ServiceMessageRow> {
    const hasAccess = await this.creatorNetwork.hasCreatorNetworkAccess(senderId);
    if (!hasAccess) {
      throw new ForbiddenException('Creator Network subscription required to send messages');
    }

    const supabase = getSupabaseClient();
    const { data: inserted, error } = await supabase
      .from('service_messages')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        request_id: requestId ?? null,
        body: body.trim(),
      })
      .select('id, sender_id, recipient_id, request_id, body, created_at')
      .single();

    if (error) throw new Error(`Failed to send message: ${error.message}`);

    const msg = {
      id: inserted.id,
      senderId: inserted.sender_id,
      recipientId: inserted.recipient_id,
      requestId: inserted.request_id,
      body: inserted.body,
      createdAt: inserted.created_at,
    };

    const senderName = await this.getDisplayName(senderId);
    const title = 'New message';
    const messageText = senderName ? `${senderName}: ${body.slice(0, 60)}${body.length > 60 ? '…' : ''}` : body.slice(0, 80);

    await this.notificationService.create({
      userId: recipientId,
      type: 'new_message',
      title,
      message: messageText,
      metadata: { senderId, messageId: inserted.id, requestId: inserted.request_id },
    });

    await this.pushNotification.sendPushNotification({
      userId: recipientId,
      title,
      body: messageText,
      data: { type: 'new_message', senderId, messageId: inserted.id },
    });

    return msg;
  }

  private async getDisplayName(userId: string): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('users').select('display_name').eq('id', userId).maybeSingle();
    return data?.display_name ?? null;
  }
}
