import { Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { getFirebaseAdmin } from '../config/firebase.config';
import { NotificationService } from '../notifications/notification.service';

interface SendPushNotificationDto {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

interface Song {
  id: string;
  title: string;
  artist_id: string;
  artist_name: string;
}

/**
 * Push Notification Service implementing Two-Stage Hybrid Pattern
 * 
 * Stage 1: "Up Next" Push (T-60s) with debounce
 * Stage 2: "Live Now" In-App Toast when song starts
 * 
 * Spam Prevention:
 * - 4-hour push notification cooldown per artist
 * - Daily limit of 6 push notifications
 * - In-app notifications always work (even during cooldown)
 */
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  // Cooldown config
  private readonly COOLDOWN_HOURS = 4;
  private readonly DEBOUNCE_SECONDS = 30;
  private readonly DAILY_PUSH_LIMIT = 6;

  // Pending notifications (for debounce)
  private pendingNotifications: Map<string, NodeJS.Timeout> = new Map();

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Stage 1: Schedule "Up Next" notification with debounce
   * Called when queue determines next song (T-60s before play)
   */
  async scheduleUpNextNotification(song: Song, secondsUntilPlay: number) {
    const artistId = song.artist_id;

    // Cancel any pending notification for this artist (debounce)
    if (this.pendingNotifications.has(artistId)) {
      clearTimeout(this.pendingNotifications.get(artistId));
      this.logger.debug(`Cancelled pending notification for artist ${artistId}`);
    }

    // Schedule notification after debounce period
    const timeout = setTimeout(async () => {
      await this.sendUpNextNotification(song);
      this.pendingNotifications.delete(artistId);
    }, this.DEBOUNCE_SECONDS * 1000);

    this.pendingNotifications.set(artistId, timeout);
    this.logger.log(`Scheduled "Up Next" notification for "${song.title}" in ${this.DEBOUNCE_SECONDS}s`);
  }

  /**
   * Send "Up Next" push notification with cooldown check
   */
  private async sendUpNextNotification(song: Song) {
    const supabase = getSupabaseClient();
    const artistId = song.artist_id;

    // Check cooldown
    const { data: cooldown } = await supabase
      .from('artist_notification_cooldowns')
      .select('last_push_sent_at, notification_count_today')
      .eq('artist_id', artistId)
      .single();

    const now = Date.now();
    const cooldownExpiry = cooldown?.last_push_sent_at
      ? new Date(cooldown.last_push_sent_at).getTime() + this.COOLDOWN_HOURS * 60 * 60 * 1000
      : 0;

    const isInCooldown = now < cooldownExpiry;
    const isDailyLimitReached = (cooldown?.notification_count_today || 0) >= this.DAILY_PUSH_LIMIT;

    if (isInCooldown || isDailyLimitReached) {
      // Within cooldown or daily limit - in-app notification only
      this.logger.log(
        `Artist ${artistId} ${isInCooldown ? 'in cooldown' : 'daily limit reached'}, sending in-app only`,
      );
      await this.notificationService.create({
        userId: artistId,
        type: 'song_up_next',
        title: "You're up next!",
        message: `"${song.title}" plays in about a minute. Tune in to see reactions!`,
        metadata: { songId: song.id, songTitle: song.title },
      });
      return;
    }

    // Outside cooldown - send push notification
    await this.sendPushNotification({
      userId: artistId,
      title: "You're up next!",
      body: `"${song.title}" plays in about a minute. Tune in to see reactions!`,
      data: {
        type: 'song_up_next',
        songId: song.id,
        action: 'open_chat', // Deep link to chat tab
      },
    });

    // Update cooldown
    const today = new Date().toDateString();
    const lastPushDate = cooldown?.last_push_sent_at
      ? new Date(cooldown.last_push_sent_at).toDateString()
      : null;

    const newCount = lastPushDate === today ? (cooldown?.notification_count_today || 0) + 1 : 1;

    await supabase.from('artist_notification_cooldowns').upsert({
      artist_id: artistId,
      last_push_sent_at: new Date().toISOString(),
      notification_count_today: newCount,
    });

    this.logger.log(`"Up Next" push sent to artist ${artistId} for "${song.title}"`);
  }

  /**
   * Stage 2: Send "Live Now" in-app toast when song actually starts
   */
  async sendLiveNowNotification(song: Song) {
    const supabase = getSupabaseClient();

    // Create in-app notification
    await this.notificationService.create({
      userId: song.artist_id,
      type: 'song_live_now',
      title: 'You are LIVE now!',
      message: `"${song.title}" is playing. Check out the chat reactions!`,
      metadata: { songId: song.id, songTitle: song.title },
    });

    // Broadcast to connected clients for immediate toast
    try {
      const channel = supabase.channel(`artist-${song.artist_id}`);
      await channel.send({
        type: 'broadcast',
        event: 'song_live',
        payload: {
          songId: song.id,
          title: song.title,
          message: 'You are LIVE now! Check out the chat reactions.',
        },
      });
      this.logger.debug(`Broadcasted "Live Now" to artist ${song.artist_id}`);
    } catch (error) {
      this.logger.warn(`Failed to broadcast "Live Now": ${error.message}`);
    }
  }

  /**
   * Send push notification via Firebase Cloud Messaging
   */
  async sendPushNotification(dto: SendPushNotificationDto): Promise<boolean> {
    const supabase = getSupabaseClient();
    const admin = getFirebaseAdmin();

    // Get user's MOBILE device tokens only (web deprioritized for Phase 1)
    const { data: tokens, error } = await supabase
      .from('user_device_tokens')
      .select('fcm_token, device_type')
      .eq('user_id', dto.userId)
      .in('device_type', ['ios', 'android']);

    if (error || !tokens || tokens.length === 0) {
      this.logger.debug(`No mobile tokens for user ${dto.userId}, falling back to in-app`);
      await this.notificationService.create({
        userId: dto.userId,
        type: dto.data?.type || 'push_notification',
        title: dto.title,
        message: dto.body,
        metadata: dto.data,
      });
      return false;
    }

    // Build FCM messages
    const messages = tokens.map((t) => ({
      token: t.fcm_token,
      notification: {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
      },
      data: {
        ...dto.data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'song_alerts',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    }));

    try {
      const response = await admin.messaging().sendEach(messages);
      this.logger.log(
        `Push sent: ${response.successCount} success, ${response.failureCount} failed`,
      );

      // Clean up invalid tokens
      response.responses.forEach((resp, idx) => {
        if (
          !resp.success &&
          (resp.error?.code === 'messaging/invalid-registration-token' ||
            resp.error?.code === 'messaging/registration-token-not-registered')
        ) {
          this.removeInvalidToken(tokens[idx].fcm_token);
        }
      });

      // Also store in notifications table for in-app history
      await this.notificationService.create({
        userId: dto.userId,
        type: dto.data?.type || 'push_notification',
        title: dto.title,
        message: dto.body,
        metadata: dto.data,
      });

      return response.successCount > 0;
    } catch (error) {
      this.logger.error(`FCM send failed: ${error.message}`);
      return false;
    }
  }

  /**
   * After a song finishes: notify the artist "Your song has been played" with a link to view analytics.
   * Creates in-app notification and optionally sends push (with playId for deep link to stats).
   */
  async sendSongPlayedNotification(dto: { artistId: string; songTitle: string; playId: string }) {
    await this.notificationService.create({
      userId: dto.artistId,
      type: 'song_played',
      title: 'Your song has been played',
      message: `"${dto.songTitle}" just finished. Tap to see how it performed.`,
      metadata: { playId: dto.playId, songTitle: dto.songTitle, action: 'open_stats' },
    });

    await this.sendPushNotification({
      userId: dto.artistId,
      title: 'Your song has been played',
      body: `"${dto.songTitle}" just finished. Tap to see how it performed.`,
      data: {
        type: 'song_played',
        playId: dto.playId,
        action: 'open_stats',
      },
    });
  }

  /**
   * Remove invalid FCM token from database
   */
  private async removeInvalidToken(token: string) {
    const supabase = getSupabaseClient();

    await supabase.from('user_device_tokens').delete().eq('fcm_token', token);

    this.logger.debug(`Removed invalid FCM token`);
  }

  /**
   * Register a device token for push notifications
   */
  async registerDeviceToken(
    userId: string,
    fcmToken: string,
    deviceType: 'ios' | 'android' | 'web',
  ) {
    const supabase = getSupabaseClient();

    const { error } = await supabase.from('user_device_tokens').upsert(
      {
        user_id: userId,
        fcm_token: fcmToken,
        device_type: deviceType,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,fcm_token',
      },
    );

    if (error) {
      this.logger.error(`Failed to register device token: ${error.message}`);
      throw new Error('Failed to register device token');
    }

    this.logger.log(`Registered ${deviceType} device token for user ${userId}`);
    return { success: true };
  }

  /**
   * Unregister a device token
   */
  async unregisterDeviceToken(userId: string, fcmToken: string) {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('user_device_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('fcm_token', fcmToken);

    if (error) {
      this.logger.error(`Failed to unregister device token: ${error.message}`);
      throw new Error('Failed to unregister device token');
    }

    this.logger.log(`Unregistered device token for user ${userId}`);
    return { success: true };
  }

  /**
   * Get user's registered devices
   */
  async getUserDevices(userId: string) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_device_tokens')
      .select('id, device_type, created_at, updated_at')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch devices: ${error.message}`);
    }

    return data;
  }
}
