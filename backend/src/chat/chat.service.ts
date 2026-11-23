import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { isRepeatedComment } from '../common/vote-integrity';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ChatMessage {
  id: string;
  user_id: string;
  song_id: string | null;
  radio_id: string;
  display_name: string;
  avatar_url: string | null;
  message: string;
  created_at: string;
  kind?: 'live' | 'comment' | null;
  song_title?: string | null;
  artist_name?: string | null;
}

type ChatKind = 'live' | 'comment';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Chat Service implementing the Backend Gatekeeper Pattern
 *
 * CRITICAL: Clients must NEVER broadcast directly to Supabase Realtime.
 * All messages flow through this service for validation, rate limiting,
 * and shadow ban checks.
 *
 * IMPORTANT: The broadcast channel must be SUBSCRIBED before sending.
 * This service maintains a persistent subscription on module init.
 */
@Injectable()
export class ChatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatService.name);
  private readonly DEFAULT_RADIO_ID = 'global';
  private readonly MAX_RADIO_ID_LENGTH = 64;
  private readonly channels = new Map<string, RealtimeChannel>();
  private readonly channelReady = new Map<string, boolean>();
  private readonly channelReadyPromises = new Map<string, Promise<void>>();
  private readonly channelReadyResolvers = new Map<string, () => void>();

  // In-memory rate limiting (use Redis in production for multi-instance)
  private rateLimits: Map<string, RateLimitEntry> = new Map();

  // Rate limit config: 1 msg/3s sustained, 5 msg/10s burst
  private readonly RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
  private readonly RATE_LIMIT_MAX_MESSAGES = 5; // Max 5 messages per window
  private readonly MIN_MESSAGE_INTERVAL_MS = 3000; // Min 3 seconds between messages

  private lastMessageTime: Map<string, number> = new Map();

  /**
   * Initialize a default channel so first chat broadcast is ready.
   */
  async onModuleInit() {
    await this.ensureChannel(this.DEFAULT_RADIO_ID);
  }

  private normalizeRadioId(radioId?: string | null): string {
    const fallback = this.DEFAULT_RADIO_ID;
    const normalized = radioId?.trim();
    if (!normalized) return fallback;
    return normalized.slice(0, this.MAX_RADIO_ID_LENGTH);
  }

  private channelNameFor(radioId: string): string {
    return `radio-chat:${radioId}`;
  }

  private commentChannelKey(songId: string): string {
    return `comment:${songId}`;
  }

  private commentChannelName(songId: string): string {
    return `song-comments:${songId}`;
  }

  private async ensureChannel(radioId: string): Promise<void> {
    const normalized = this.normalizeRadioId(radioId);
    await this.ensureNamedChannel(normalized, this.channelNameFor(normalized));
  }

  private async ensureCommentChannel(songId: string): Promise<void> {
    const id = songId.trim();
    await this.ensureNamedChannel(
      this.commentChannelKey(id),
      this.commentChannelName(id),
    );
  }

  private async ensureNamedChannel(
    key: string,
    channelName: string,
  ): Promise<void> {
    const existing = this.channels.get(key);
    if (existing) return;

    const supabase = getSupabaseClient();
    const channel = supabase.channel(channelName);

    this.channelReady.set(key, false);
    this.channelReadyPromises.set(
      key,
      new Promise((resolve) => {
        this.channelReadyResolvers.set(key, resolve);
      }),
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.channelReady.set(key, true);
        this.channelReadyResolvers.get(key)?.();
        this.logger.log(`Chat channel ready: ${channelName}`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.logger.warn(`Chat channel unhealthy (${channelName}): ${status}`);
        this.channelReady.set(key, false);
      } else if (status === 'CLOSED') {
        this.logger.warn(`Chat channel closed: ${channelName}`);
        this.channelReady.set(key, false);
        this.channels.delete(key);
      }
    });

    this.channels.set(key, channel);
  }

  /**
   * Wait for channel to be ready (with timeout).
   */
  private async waitForChannel(
    radioId: string,
    timeoutMs = 5000,
  ): Promise<boolean> {
    const normalized = this.normalizeRadioId(radioId);
    if (this.channelReady.get(normalized)) return true;
    const readyPromise = this.channelReadyPromises.get(normalized);
    if (!readyPromise) return false;

    try {
      await Promise.race([
        readyPromise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Channel ready timeout')),
            timeoutMs,
          ),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up channel subscription on module destroy.
   */
  async onModuleDestroy() {
    for (const [radioId, channel] of this.channels.entries()) {
      await channel.unsubscribe();
      this.logger.log(`Chat broadcast channel unsubscribed: ${radioId}`);
    }
    this.channels.clear();
    this.channelReady.clear();
    this.channelReadyPromises.clear();
    this.channelReadyResolvers.clear();
  }

  /**
   * Send a chat message (Backend Gatekeeper)
   *
   * Flow:
   * 1. Check rate limits
   * 2. Check shadow ban status
   * 3. If shadow banned: Return 200 OK but DON'T broadcast
   * 4. If valid: Save to chat_messages and broadcast
   */
  async sendMessage(
    userId: string,
    message: string,
    songId: string | null,
    radioId: string,
    displayName: string,
    avatarUrl: string | null,
    kind: ChatKind = 'live',
  ): Promise<{ success: boolean; id: string }> {
    const supabase = getSupabaseClient();

    // Check if chat is enabled globally
    const { data: config } = await supabase
      .from('chat_config')
      .select('enabled, disabled_reason')
      .eq('id', 'global')
      .single();

    if (!config?.enabled) {
      throw new BadRequestException(
        config?.disabled_reason || 'Chat is currently disabled',
      );
    }

    // Check rate limits
    this.checkRateLimit(userId);

    // Check shadow ban status
    const { data: user } = await supabase
      .from('users')
      .select('is_shadow_banned, shadow_banned_until')
      .eq('id', userId)
      .single();

    // If shadow banned and ban hasn't expired
    if (user?.is_shadow_banned) {
      if (
        !user.shadow_banned_until ||
        new Date(user.shadow_banned_until) > new Date()
      ) {
        // Return success but DON'T broadcast - troll screams into the void
        this.logger.log(`Shadow banned message from ${userId} suppressed`);
        return { success: true, id: `shadow-${Date.now()}` };
      }
    }

    // Validate message length
    if (message.length > 280) {
      throw new BadRequestException('Message too long (max 280 characters)');
    }

    if (message.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }

    const normalizedRadioId = this.normalizeRadioId(radioId);
    const messageKind: ChatKind = kind === 'comment' ? 'comment' : 'live';
    if (messageKind === 'comment' && !songId?.trim()) {
      throw new BadRequestException('Comments require a song');
    }

    if (await isRepeatedComment(supabase, userId, message)) {
      this.logger.log(`Repeated comment from ${userId} ignored`);
      return { success: true, id: `ignored-${Date.now()}` };
    }

    // Save message to database
    const { data: savedMessage, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        song_id: songId,
        radio_id: normalizedRadioId,
        display_name: displayName,
        avatar_url: avatarUrl,
        message: message.trim(),
        kind: messageKind,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to save message: ${error.message}`);
      throw new BadRequestException('Failed to send message');
    }

    // Broadcast to Supabase Realtime channel
    await this.broadcast(savedMessage);

    this.logger.log(
      `Chat message sent by ${displayName}: ${message.substring(0, 50)}...`,
    );

    return { success: true, id: savedMessage.id };
  }

  /**
   * Get chat history for hydration (last 50 messages)
   */
  async getHistory(limit = 50, radioId?: string): Promise<ChatMessage[]> {
    const supabase = getSupabaseClient();
    const normalizedRadioId = this.normalizeRadioId(radioId);

    const { data, error } = await supabase
      .from('chat_messages')
      .select(
        'id, user_id, song_id, radio_id, display_name, avatar_url, message, created_at, kind, songs(title, artist_name)',
      )
      .eq('radio_id', normalizedRadioId)
      .eq('kind', 'live')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(`Failed to fetch chat history: ${error.message}`);
      throw new BadRequestException('Failed to fetch chat history');
    }

    // Return in chronological order (oldest first)
    return (data || []).reverse().map((row) => this.withSongLabel(row));
  }

  /**
   * Comments posted while this song was playing. Shared across stations.
   */
  async getComments(songId: string, limit = 100): Promise<ChatMessage[]> {
    const id = songId?.trim();
    if (!id) {
      throw new BadRequestException('songId is required');
    }
    const supabase = getSupabaseClient();
    const capped = Math.min(Math.max(limit, 1), 100);
    const { data, error } = await supabase
      .from('chat_messages')
      .select(
        'id, user_id, song_id, radio_id, display_name, avatar_url, message, created_at, kind, songs(title, artist_name)',
      )
      .eq('song_id', id)
      .eq('kind', 'comment')
      .order('created_at', { ascending: true })
      .limit(capped);

    if (error) {
      this.logger.error(`Failed to fetch comments: ${error.message}`);
      throw new BadRequestException('Failed to fetch comments');
    }

    return (data || []).map((row) => this.withSongLabel(row));
  }

  private withSongLabel(row: Record<string, unknown>): ChatMessage {
    const songs = row.songs as
      | { title?: string | null; artist_name?: string | null }
      | { title?: string | null; artist_name?: string | null }[]
      | null
      | undefined;
    const song = Array.isArray(songs) ? songs[0] : songs;
    const kind = row.kind === 'comment' ? 'comment' : 'live';
    return {
      id: String(row.id),
      user_id: String(row.user_id),
      song_id: (row.song_id as string | null) ?? null,
      radio_id: String(row.radio_id ?? 'global'),
      display_name: String(row.display_name ?? 'Anonymous'),
      avatar_url: (row.avatar_url as string | null) ?? null,
      message: String(row.message ?? ''),
      created_at: String(row.created_at ?? ''),
      kind,
      song_title: song?.title ?? null,
      artist_name: song?.artist_name ?? null,
    };
  }

  private async lookupSongLabel(songId: string | null): Promise<{
    songTitle: string | null;
    artistName: string | null;
  }> {
    if (!songId?.trim()) return { songTitle: null, artistName: null };
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('songs')
      .select('title, artist_name')
      .eq('id', songId)
      .maybeSingle();
    return {
      songTitle: data?.title ?? null,
      artistName: data?.artist_name ?? null,
    };
  }

  /**
   * Get chat status (enabled/disabled)
   */
  async getChatStatus(): Promise<{ enabled: boolean; reason?: string }> {
    const supabase = getSupabaseClient();

    const { data } = await supabase
      .from('chat_config')
      .select('enabled, disabled_reason')
      .eq('id', 'global')
      .single();

    return {
      enabled: data?.enabled ?? true,
      reason: data?.disabled_reason,
    };
  }

  /**
   * Broadcast an emoji burst on the station chat channel.
   * Uses the same persistent subscribed channel as chat messages.
   */
  async broadcastEmojiBurst(
    radioId: string,
    payload: {
      songId: string;
      emojis: Record<string, string>;
      timestamp: string;
    },
  ): Promise<void> {
    const normalized = this.normalizeRadioId(radioId);
    await this.ensureChannel(normalized);
    const channel = this.channels.get(normalized);
    if (!channel) return;

    if (!this.channelReady.get(normalized)) {
      const ready = await this.waitForChannel(normalized, 5000);
      if (!ready) {
        this.logger.warn(
          `Emoji burst skipped — chat channel not ready for ${normalized}`,
        );
        return;
      }
    }

    try {
      await channel.send({
        type: 'broadcast',
        event: 'emoji_burst',
        payload: {
          songId: payload.songId,
          radioId: normalized,
          emojis: payload.emojis,
          timestamp: payload.timestamp,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to broadcast emoji burst: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Broadcast message to Supabase Realtime channel
   * ONLY the backend should call this - never clients
   *
   * IMPORTANT: Uses the persistent chatChannel which was subscribed on init.
   * Creating a new channel each time does NOT work - the channel must be
   * subscribed before broadcasting.
   */
  private async broadcast(message: ChatMessage) {
    const radioId = this.normalizeRadioId(message.radio_id);
    const isComment = message.kind === 'comment' && !!message.song_id;
    const channelKey = isComment
      ? this.commentChannelKey(message.song_id as string)
      : radioId;
    if (isComment) {
      await this.ensureCommentChannel(message.song_id as string);
    } else {
      await this.ensureChannel(radioId);
    }
    const channel = this.channels.get(channelKey);
    if (!channel) return;

    // Wait for channel to be ready before broadcasting
    if (!this.channelReady.get(channelKey)) {
      this.logger.warn(`Chat channel not ready for ${channelKey}, waiting...`);
      const ready = await this.waitForChannel(channelKey, 5000);
      if (!ready) {
        this.logger.error(
          'Chat channel not ready after timeout - message not broadcasted',
        );
        return;
      }
    }

    const label = await this.lookupSongLabel(message.song_id);

    try {
      // Use the persistent, already-subscribed channel
      await channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          id: message.id,
          userId: message.user_id,
          songId: message.song_id,
          radioId: radioId,
          displayName: message.display_name,
          avatarUrl: message.avatar_url,
          message: message.message,
          createdAt: message.created_at,
          kind: isComment ? 'comment' : 'live',
          songTitle: label.songTitle,
          artistName: label.artistName,
        },
      });

      this.logger.debug(`Broadcasted message ${message.id} to ${channelKey}`);
    } catch (error) {
      this.logger.error(`Failed to broadcast message: ${error.message}`);
      // Don't throw - message is already saved
    }
  }

  /**
   * Check rate limits for a user
   * Throws if rate limit exceeded
   */
  private checkRateLimit(userId: string) {
    const now = Date.now();

    // Check minimum interval between messages (3 seconds)
    const lastTime = this.lastMessageTime.get(userId);
    if (lastTime && now - lastTime < this.MIN_MESSAGE_INTERVAL_MS) {
      const waitSeconds = Math.ceil(
        (this.MIN_MESSAGE_INTERVAL_MS - (now - lastTime)) / 1000,
      );
      throw new BadRequestException(
        `Please wait ${waitSeconds} seconds before sending another message`,
      );
    }

    // Check burst limit (5 messages per 10 seconds)
    let entry = this.rateLimits.get(userId);

    if (!entry || now - entry.windowStart > this.RATE_LIMIT_WINDOW_MS) {
      // Start new window
      entry = { count: 1, windowStart: now };
      this.rateLimits.set(userId, entry);
    } else {
      entry.count++;
      if (entry.count > this.RATE_LIMIT_MAX_MESSAGES) {
        throw new BadRequestException(
          'You are sending messages too quickly. Please slow down.',
        );
      }
    }

    // Update last message time
    this.lastMessageTime.set(userId, now);

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      this.cleanupRateLimits();
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimits() {
    const now = Date.now();
    const expiry = this.RATE_LIMIT_WINDOW_MS * 2;

    for (const [userId, entry] of this.rateLimits.entries()) {
      if (now - entry.windowStart > expiry) {
        this.rateLimits.delete(userId);
      }
    }

    for (const [userId, time] of this.lastMessageTime.entries()) {
      if (now - time > expiry) {
        this.lastMessageTime.delete(userId);
      }
    }
  }
}
