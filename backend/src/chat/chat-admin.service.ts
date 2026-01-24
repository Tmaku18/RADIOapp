import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

/**
 * Admin service for chat moderation
 * 
 * Features:
 * - Kill Switch: Instantly disable chat globally
 * - Shadow Ban: Ban users without them knowing (they think messages send)
 * - Unban: Remove shadow bans
 */
@Injectable()
export class ChatAdminService {
  private readonly logger = new Logger(ChatAdminService.name);

  /**
   * Toggle chat globally (Kill Switch)
   */
  async toggleChat(enabled: boolean, reason?: string) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('chat_config')
      .update({
        enabled,
        disabled_reason: enabled ? null : reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'global')
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to toggle chat: ${error.message}`);
    }

    this.logger.log(`Chat ${enabled ? 'enabled' : 'disabled'}${reason ? `: ${reason}` : ''}`);

    return {
      enabled: data.enabled,
      disabledReason: data.disabled_reason,
    };
  }

  /**
   * Shadow ban a user
   * Their messages will appear to send but won't be broadcast
   */
  async shadowBanUser(userId: string, durationHours?: number) {
    const supabase = getSupabaseClient();

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    const shadowBannedUntil = durationHours
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
      : null; // null = permanent

    const { error } = await supabase
      .from('users')
      .update({
        is_shadow_banned: true,
        shadow_banned_until: shadowBannedUntil,
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to shadow ban user: ${error.message}`);
    }

    this.logger.log(
      `Shadow banned user ${user.display_name} (${userId})` +
        (durationHours ? ` for ${durationHours} hours` : ' permanently'),
    );

    return {
      userId,
      displayName: user.display_name,
      shadowBannedUntil,
      permanent: !durationHours,
    };
  }

  /**
   * Remove shadow ban from a user
   */
  async unbanUser(userId: string) {
    const supabase = getSupabaseClient();

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, display_name, is_shadow_banned')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    if (!user.is_shadow_banned) {
      return {
        userId,
        displayName: user.display_name,
        wasUnbanned: false,
        message: 'User was not shadow banned',
      };
    }

    const { error } = await supabase
      .from('users')
      .update({
        is_shadow_banned: false,
        shadow_banned_until: null,
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to unban user: ${error.message}`);
    }

    this.logger.log(`Removed shadow ban from ${user.display_name} (${userId})`);

    return {
      userId,
      displayName: user.display_name,
      wasUnbanned: true,
    };
  }

  /**
   * Get list of shadow banned users
   */
  async getShadowBannedUsers() {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, email, shadow_banned_until')
      .eq('is_shadow_banned', true);

    if (error) {
      throw new Error(`Failed to fetch shadow banned users: ${error.message}`);
    }

    return data.map((user) => ({
      userId: user.id,
      displayName: user.display_name,
      email: user.email,
      shadowBannedUntil: user.shadow_banned_until,
      isPermanent: !user.shadow_banned_until,
    }));
  }

  /**
   * Delete a specific message (visible moderation)
   */
  async deleteMessage(messageId: string) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      throw new NotFoundException('Message not found');
    }

    this.logger.log(`Deleted message ${messageId}`);

    // Broadcast deletion to clients
    try {
      const channel = supabase.channel('radio-chat');
      await channel.send({
        type: 'broadcast',
        event: 'message_deleted',
        payload: { messageId },
      });
    } catch (e) {
      this.logger.warn(`Failed to broadcast message deletion: ${e.message}`);
    }

    return { deleted: true, messageId };
  }
}
