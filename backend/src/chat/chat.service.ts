import { Injectable, Logger, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ChatMessage {
  id: string;
  user_id: string;
  song_id: string | null;
  display_name: string;
  avatar_url: string | null;
  message: string;
  created_at: string;
}

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
  
  // Persistent Realtime channel for broadcasting
  private chatChannel: RealtimeChannel | null = null;

  // In-memory rate limiting (use Redis in production for multi-instance)
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  
  // Rate limit config: 1 msg/3s sustained, 5 msg/10s burst
  private readonly RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
  private readonly RATE_LIMIT_MAX_MESSAGES = 5; // Max 5 messages per window
  private readonly MIN_MESSAGE_INTERVAL_MS = 3000; // Min 3 seconds between messages

  private lastMessageTime: Map<string, number> = new Map();

  /**
   * Initialize the Realtime channel subscription on module start.
   * The channel MUST be subscribed before we can broadcast to it.
   */
  async onModuleInit() {
    const supabase = getSupabaseClient();
    
    this.chatChannel = supabase.channel('radio-chat');
    
    // Subscribe to the channel (required before sending)
    this.chatChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.logger.log('Chat broadcast channel subscribed and ready');
      } else if (status === 'CHANNEL_ERROR') {
        this.logger.error('Chat channel subscription error');
      } else if (status === 'TIMED_OUT') {
        this.logger.warn('Chat channel subscription timed out');
      }
    });
  }

  /**
   * Clean up channel subscription on module destroy.
   */
  async onModuleDestroy() {
    if (this.chatChannel) {
      await this.chatChannel.unsubscribe();
      this.logger.log('Chat broadcast channel unsubscribed');
    }
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
    displayName: string,
    avatarUrl: string | null,
  ): Promise<{ success: boolean; id: string }> {
    const supabase = getSupabaseClient();

    // Check if chat is enabled globally
    const { data: config } = await supabase
      .from('chat_config')
      .select('enabled, disabled_reason')
      .eq('id', 'global')
      .single();

    if (!config?.enabled) {
      throw new BadRequestException(config?.disabled_reason || 'Chat is currently disabled');
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
      if (!user.shadow_banned_until || new Date(user.shadow_banned_until) > new Date()) {
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

    // Save message to database
    const { data: savedMessage, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        song_id: songId,
        display_name: displayName,
        avatar_url: avatarUrl,
        message: message.trim(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to save message: ${error.message}`);
      throw new BadRequestException('Failed to send message');
    }

    // Broadcast to Supabase Realtime channel
    await this.broadcast(savedMessage);

    this.logger.log(`Chat message sent by ${displayName}: ${message.substring(0, 50)}...`);

    return { success: true, id: savedMessage.id };
  }

  /**
   * Get chat history for hydration (last 50 messages)
   */
  async getHistory(limit = 50): Promise<ChatMessage[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(`Failed to fetch chat history: ${error.message}`);
      throw new BadRequestException('Failed to fetch chat history');
    }

    // Return in chronological order (oldest first)
    return (data || []).reverse();
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
   * Broadcast message to Supabase Realtime channel
   * ONLY the backend should call this - never clients
   * 
   * IMPORTANT: Uses the persistent chatChannel which was subscribed on init.
   * Creating a new channel each time does NOT work - the channel must be
   * subscribed before broadcasting.
   */
  private async broadcast(message: ChatMessage) {
    if (!this.chatChannel) {
      this.logger.error('Chat channel not initialized - cannot broadcast');
      return;
    }

    try {
      // Use the persistent, already-subscribed channel
      await this.chatChannel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          id: message.id,
          userId: message.user_id,
          songId: message.song_id,
          displayName: message.display_name,
          avatarUrl: message.avatar_url,
          message: message.message,
          createdAt: message.created_at,
        },
      });

      this.logger.debug(`Broadcasted message ${message.id} to radio-chat channel`);
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
      const waitSeconds = Math.ceil((this.MIN_MESSAGE_INTERVAL_MS - (now - lastTime)) / 1000);
      throw new BadRequestException(`Please wait ${waitSeconds} seconds before sending another message`);
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
        throw new BadRequestException('You are sending messages too quickly. Please slow down.');
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
