import { Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { getFirebaseAdmin } from '../config/firebase.config';
import { NotificationService } from '../notifications/notification.service';
import { stationDisplayName } from '../radio/station.constants';

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
  play_count?: number;
}

interface ArtistLiveFanoutDto {
  artistId: string;
  artistName: string;
  sessionId: string;
  songId?: string;
}

interface ArtistSongOnRadioFanoutDto {
  artistId: string;
  artistName: string;
  songId: string;
  songTitle: string;
  radioId?: string;
  /** Minutes until play (5 or 1). */
  minutesUntil?: number;
  /** True when this is the song's first radio play. */
  isFirstPlay?: boolean;
}

interface ArtistNewUploadFanoutDto {
  artistId: string;
  artistName: string;
  songId: string;
  songTitle: string;
  stationIds?: string[];
}

interface AppUpdateBroadcastDto {
  title: string;
  body: string;
  latestVersion: string;
  storeUrl?: string;
  forceUpdate?: boolean;
  platform?: 'ios' | 'android' | 'all';
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

  // Per-follower cooldown when a followed artist goes on radio (avoid spam)
  private readonly FOLLOWER_RADIO_COOLDOWN_MS = 2 * 60 * 60 * 1000;
  private readonly FOLLOWER_UP_NEXT_COOLDOWN_MS = 90 * 60 * 1000;
  private followerRadioCooldown = new Map<string, number>();
  private followerUpNextCooldown = new Map<string, number>();

  constructor(private readonly notificationService: NotificationService) {}

  private isFollowerRadioInCooldown(
    followerId: string,
    artistId: string,
  ): boolean {
    const key = `${followerId}:${artistId}`;
    const until = this.followerRadioCooldown.get(key);
    return until != null && Date.now() < until;
  }

  private markFollowerRadioCooldown(followerId: string, artistId: string) {
    this.followerRadioCooldown.set(
      `${followerId}:${artistId}`,
      Date.now() + this.FOLLOWER_RADIO_COOLDOWN_MS,
    );
  }

  private isFollowerUpNextInCooldown(
    followerId: string,
    artistId: string,
  ): boolean {
    const key = `${followerId}:${artistId}`;
    const until = this.followerUpNextCooldown.get(key);
    return until != null && Date.now() < until;
  }

  private markFollowerUpNextCooldown(followerId: string, artistId: string) {
    this.followerUpNextCooldown.set(
      `${followerId}:${artistId}`,
      Date.now() + this.FOLLOWER_UP_NEXT_COOLDOWN_MS,
    );
  }

  private isMissingUserFollowsTable(error: unknown): boolean {
    const maybeError = error as { code?: string; message?: string } | null;
    const message = (maybeError?.message ?? '').toLowerCase();
    return (
      (maybeError?.code === '42P01' &&
        (message.includes('user_follows') ||
          message.includes('public.user_follows'))) ||
      (maybeError?.code === 'PGRST205' &&
        (message.includes("'public.user_follows'") ||
          message.includes("'user_follows'") ||
          message.includes('user_follows')))
    );
  }

  /**
   * Schedule an upcoming-play alert (5 minutes or 1 minute) with debounce.
   * @param minutesUntilPlay 5 or 1
   */
  async scheduleUpNextNotification(
    song: Song,
    secondsUntilPlay: number,
    radioId?: string,
  ) {
    const minutes =
      secondsUntilPlay >= 240 ? 5 : secondsUntilPlay >= 45 ? 1 : 1;
    return this.scheduleUpcomingPlayNotification(song, minutes, radioId);
  }

  async scheduleUpcomingPlayNotification(
    song: Song,
    minutesUntilPlay: 5 | 1,
    radioId?: string,
    isFirstPlay?: boolean,
  ) {
    const artistId = song.artist_id;
    if (!artistId) return;

    const debounceKey = `${artistId}:${minutesUntilPlay}:${radioId ?? 'default'}`;
    if (this.pendingNotifications.has(debounceKey)) {
      clearTimeout(this.pendingNotifications.get(debounceKey));
    }

    const timeout = setTimeout(async () => {
      await this.sendUpcomingPlayNotification(
        song,
        minutesUntilPlay,
        radioId,
        isFirstPlay,
      );
      this.pendingNotifications.delete(debounceKey);
    }, this.DEBOUNCE_SECONDS * 1000);

    this.pendingNotifications.set(debounceKey, timeout);
    this.logger.log(
      `Scheduled T-${minutesUntilPlay}m alert for "${song.title}"` +
        (radioId ? ` on ${stationDisplayName(radioId)}` : ''),
    );
  }

  /**
   * Send T-5m / T-1m push to the artist, then fan out to followers.
   */
  private async sendUpcomingPlayNotification(
    song: Song,
    minutesUntilPlay: 5 | 1,
    radioId?: string,
    isFirstPlay?: boolean,
  ) {
    const supabase = getSupabaseClient();
    const artistId = song.artist_id;
    if (!artistId) return;

    const station = stationDisplayName(radioId);
    const whenLabel =
      minutesUntilPlay === 5 ? 'in about 5 minutes' : 'in about 1 minute';
    const title =
      minutesUntilPlay === 5 ? "You're coming up soon!" : "You're up next!";
    const body = `"${song.title}" plays ${whenLabel} on ${station}. Tune in!`;

    // Check cooldown (artists only — followers have their own cooldowns)
    const { data: cooldown } = await supabase
      .from('artist_notification_cooldowns')
      .select('last_push_sent_at, notification_count_today')
      .eq('artist_id', artistId)
      .single();

    const now = Date.now();
    const cooldownExpiry = cooldown?.last_push_sent_at
      ? new Date(cooldown.last_push_sent_at).getTime() +
        this.COOLDOWN_HOURS * 60 * 60 * 1000
      : 0;

    const isInCooldown = now < cooldownExpiry;
    const isDailyLimitReached =
      (cooldown?.notification_count_today || 0) >= this.DAILY_PUSH_LIMIT;

    const notifType =
      minutesUntilPlay === 5 ? 'song_up_next_5min' : 'song_up_next';

    if (isInCooldown || isDailyLimitReached) {
      this.logger.log(
        `Artist ${artistId} ${isInCooldown ? 'in cooldown' : 'daily limit reached'}, sending in-app only`,
      );
      await this.notificationService.create({
        userId: artistId,
        type: notifType,
        title,
        message: body,
        metadata: {
          songId: song.id,
          songTitle: song.title,
          radioId: radioId ?? null,
          stationName: station,
          minutesUntil: minutesUntilPlay,
        },
      });
    } else {
      await this.sendPushNotification({
        userId: artistId,
        title,
        body,
        data: {
          type: notifType,
          songId: song.id,
          songTitle: song.title ?? '',
          radioId: radioId ?? '',
          stationName: station,
          minutesUntil: String(minutesUntilPlay),
          action: 'open_radio',
        },
      });

      const today = new Date().toDateString();
      const lastPushDate = cooldown?.last_push_sent_at
        ? new Date(cooldown.last_push_sent_at).toDateString()
        : null;

      const newCount =
        lastPushDate === today
          ? (cooldown?.notification_count_today || 0) + 1
          : 1;

      await supabase.from('artist_notification_cooldowns').upsert({
        artist_id: artistId,
        last_push_sent_at: new Date().toISOString(),
        notification_count_today: newCount,
      });
    }

    const firstPlay =
      isFirstPlay === true || !(Number(song.play_count || 0) > 0);

    await this.notifyFollowersArtistUpNext({
      artistId,
      artistName: song.artist_name || 'An artist you follow',
      songId: song.id,
      songTitle: song.title || 'a song',
      radioId,
      minutesUntil: minutesUntilPlay,
      isFirstPlay: firstPlay,
    }).catch((err) =>
      this.logger.warn(
        `Follower up-next fanout failed: ${(err as Error)?.message ?? err}`,
      ),
    );
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
      this.logger.debug(
        `No mobile tokens for user ${dto.userId}, falling back to in-app`,
      );
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
          // Must match mobile AndroidNotificationChannel id.
          channelId: 'radio_alerts',
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
  async sendSongPlayedNotification(dto: {
    artistId: string;
    songTitle: string;
    playId: string;
  }) {
    await this.notificationService.create({
      userId: dto.artistId,
      type: 'song_played',
      title: 'Your song has been played',
      message: `"${dto.songTitle}" just finished. Tap to see how it performed.`,
      metadata: {
        playId: dto.playId,
        songTitle: dto.songTitle,
        action: 'open_stats',
      },
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
   * Prompt an artist to go live while their song is actively airing.
   */
  async sendGoLiveNudgeToArtist(dto: {
    artistId: string;
    songId: string;
    songTitle: string;
  }) {
    await this.notificationService.create({
      userId: dto.artistId,
      type: 'artist_live_nudge',
      title: 'Your song is live. Go live now?',
      message: `"${dto.songTitle}" is on the radio. Start your stream now so listeners can join.`,
      metadata: {
        songId: dto.songId,
        action: 'open_go_live',
      },
    });

    await this.sendPushNotification({
      userId: dto.artistId,
      title: 'Go live while your song is playing',
      body: `"${dto.songTitle}" is on-air now. Start a stream and bring listeners in.`,
      data: {
        type: 'artist_live_nudge',
        songId: dto.songId,
        action: 'open_go_live',
      },
    });
  }

  /**
   * Notify currently active radio listeners that an artist just went live.
   * Active listeners are approximated from heartbeat sessions in the last 2 minutes.
   */
  async notifyActiveListenersArtistLive(
    dto: ArtistLiveFanoutDto,
  ): Promise<{ notified: number }> {
    const supabase = getSupabaseClient();
    const cutoffIso = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from('prospector_sessions')
      .select('user_id, last_heartbeat_at')
      .is('ended_at', null)
      .gte('last_heartbeat_at', cutoffIso);

    if (error) {
      this.logger.warn(
        `Failed to load active listeners for live fanout: ${error.message}`,
      );
      return { notified: 0 };
    }

    const userIds = Array.from(
      new Set(
        (rows || []).map((r: any) => r.user_id as string).filter(Boolean),
      ),
    );
    if (userIds.length === 0) {
      return { notified: 0 };
    }

    const title = `${dto.artistName} is live now`;
    const body =
      'Join the livestream from the artist page while the track is on-air.';
    let successCount = 0;

    await Promise.allSettled(
      userIds.map(async (userId) => {
        const sent = await this.sendPushNotification({
          userId,
          title,
          body,
          data: {
            type: 'artist_live_now',
            artistId: dto.artistId,
            sessionId: dto.sessionId,
            songId: dto.songId || '',
            action: 'open_artist_live',
          },
        });
        if (sent) successCount += 1;
      }),
    );

    return { notified: successCount };
  }

  /**
   * Load follower IDs for an artist (user_follows, with artist_follows fallback).
   */
  private async loadFollowerIds(artistId: string): Promise<Set<string>> {
    const supabase = getSupabaseClient();
    const { data: followRows, error: followError } = await supabase
      .from('user_follows')
      .select('follower_user_id')
      .eq('followed_user_id', artistId);

    let followerIds = new Set(
      (followRows || [])
        .map((row: any) => row.follower_user_id as string)
        .filter(Boolean),
    );

    if (followError && this.isMissingUserFollowsTable(followError)) {
      const { data: legacyRows, error: legacyError } = await supabase
        .from('artist_follows')
        .select('user_id')
        .eq('artist_id', artistId);
      if (legacyError) {
        this.logger.warn(
          `Failed to load artist followers for fanout: ${legacyError.message}`,
        );
        return new Set();
      }
      followerIds = new Set(
        (legacyRows || [])
          .map((row: any) => row.user_id as string)
          .filter(Boolean),
      );
    } else if (followError) {
      this.logger.warn(
        `Failed to load user followers for fanout: ${followError.message}`,
      );
      return new Set();
    }

    followerIds.delete(artistId);
    return followerIds;
  }

  /**
   * Followers who opted into followed-artist radio alerts.
   */
  private async loadEligibleRadioFollowers(
    followerIds: Set<string>,
  ): Promise<{ targets: Set<string>; prefsError: boolean }> {
    if (followerIds.size === 0) {
      return { targets: new Set(), prefsError: false };
    }
    const supabase = getSupabaseClient();
    const { data: followerPrefs, error: prefsError } = await supabase
      .from('users')
      .select('id, notify_followed_artist_on_radio')
      .in('id', [...followerIds]);

    if (prefsError) {
      this.logger.warn(
        `Failed to load follower radio notification prefs: ${prefsError.message}`,
      );
      return { targets: followerIds, prefsError: true };
    }

    const eligible = new Set(
      (followerPrefs || [])
        .filter((row: any) => row.notify_followed_artist_on_radio !== false)
        .map((row: any) => row.id as string)
        .filter(Boolean),
    );
    return { targets: eligible, prefsError: false };
  }

  /**
   * Notify followers 5 or 1 minute before a followed artist's song plays.
   */
  async notifyFollowersArtistUpNext(
    dto: ArtistSongOnRadioFanoutDto,
  ): Promise<{ notified: number; followers: number }> {
    const followerIds = await this.loadFollowerIds(dto.artistId);
    if (followerIds.size === 0) {
      return { notified: 0, followers: 0 };
    }

    const { targets } = await this.loadEligibleRadioFollowers(followerIds);
    if (targets.size === 0) {
      return { notified: 0, followers: followerIds.size };
    }

    const minutes = dto.minutesUntil === 5 ? 5 : 1;
    const station = stationDisplayName(dto.radioId);
    const first =
      dto.isFirstPlay === true
        ? ' — first time on this station'
        : '';
    const title =
      minutes === 5
        ? `${dto.artistName} plays in 5 minutes`
        : `${dto.artistName} is up next`;
    const body = `"${dto.songTitle}" plays in about ${minutes} minute${
      minutes === 1 ? '' : 's'
    } on ${station}${first}.`;
    const notificationData = {
      type:
        minutes === 5
          ? 'followed_artist_up_next_5min'
          : 'followed_artist_up_next',
      artistId: dto.artistId,
      songId: dto.songId,
      songTitle: dto.songTitle,
      radioId: dto.radioId || '',
      stationName: station,
      minutesUntil: String(minutes),
      isFirstPlay: dto.isFirstPlay ? '1' : '0',
      action: 'open_radio',
      route: '/listen',
    };

    let notified = 0;
    await Promise.allSettled(
      [...targets].map(async (userId) => {
        // 5-minute alerts skip the short up-next cooldown so both can fire.
        if (
          minutes === 1 &&
          this.isFollowerUpNextInCooldown(userId, dto.artistId)
        ) {
          return;
        }

        const sent = await this.sendPushNotification({
          userId,
          title,
          body,
          data: notificationData,
        });
        if (minutes === 1) {
          this.markFollowerUpNextCooldown(userId, dto.artistId);
        }
        if (sent) notified += 1;
        else notified += 1;
      }),
    );

    this.logger.log(
      `Follower T-${minutes}m fanout for ${dto.artistId}: ${notified}/${targets.size}`,
    );
    return { notified, followers: targets.size };
  }

  /**
   * Notify followers when an artist's song is currently playing on radio.
   */
  async notifyFollowersArtistOnRadio(
    dto: ArtistSongOnRadioFanoutDto,
  ): Promise<{ notified: number; followers: number }> {
    const followerIds = await this.loadFollowerIds(dto.artistId);
    if (followerIds.size === 0) {
      return { notified: 0, followers: 0 };
    }

    const { targets } = await this.loadEligibleRadioFollowers(followerIds);
    if (targets.size === 0) {
      return { notified: 0, followers: followerIds.size };
    }

    const station = stationDisplayName(dto.radioId);
    const first =
      dto.isFirstPlay === true
        ? ' for the first time'
        : '';
    const title =
      dto.isFirstPlay === true
        ? `${dto.artistName} is live for the first time`
        : `${dto.artistName} is on the radio now`;
    const body = `"${dto.songTitle}" is playing${first} on ${station}. Tune in now.`;
    const notificationData = {
      type:
        dto.isFirstPlay === true
          ? 'artist_song_first_play'
          : 'artist_song_on_radio',
      artistId: dto.artistId,
      songId: dto.songId,
      songTitle: dto.songTitle,
      radioId: dto.radioId || '',
      stationName: station,
      isFirstPlay: dto.isFirstPlay ? '1' : '0',
      action: 'open_radio',
      route: '/listen',
    };

    let notified = 0;
    await Promise.allSettled(
      [...targets].map(async (userId) => {
        if (
          dto.isFirstPlay !== true &&
          this.isFollowerRadioInCooldown(userId, dto.artistId)
        ) {
          return;
        }

        const sent = await this.sendPushNotification({
          userId,
          title,
          body,
          data: notificationData,
        });
        this.markFollowerRadioCooldown(userId, dto.artistId);
        if (sent) notified += 1;
        else notified += 1;
      }),
    );

    return { notified, followers: targets.size };
  }

  /**
   * Notify followers when an artist they follow uploads a new song.
   */
  async notifyFollowersArtistNewUpload(
    dto: ArtistNewUploadFanoutDto,
  ): Promise<{ notified: number; followers: number }> {
    const followerIds = await this.loadFollowerIds(dto.artistId);
    if (followerIds.size === 0) {
      return { notified: 0, followers: 0 };
    }

    const { targets } = await this.loadEligibleRadioFollowers(followerIds);
    if (targets.size === 0) {
      return { notified: 0, followers: followerIds.size };
    }

    const stations = (dto.stationIds ?? [])
      .map((id) => stationDisplayName(id))
      .filter(Boolean);
    const stationHint =
      stations.length === 0
        ? 'Watch for it on Networx Radio.'
        : stations.length === 1
          ? `Look for it first on ${stations[0]}.`
          : `Stations: ${stations.slice(0, 3).join(', ')}${
              stations.length > 3 ? '…' : ''
            }.`;

    const title = `${dto.artistName} uploaded a new song`;
    const body = `"${dto.songTitle}" is in. ${stationHint}`;
    const notificationData = {
      type: 'followed_artist_new_upload',
      artistId: dto.artistId,
      songId: dto.songId,
      songTitle: dto.songTitle,
      action: 'open_notifications',
      route: '/notifications',
    };

    let notified = 0;
    await Promise.allSettled(
      [...targets].map(async (userId) => {
        const sent = await this.sendPushNotification({
          userId,
          title,
          body,
          data: notificationData,
        });
        if (sent) notified += 1;
        else notified += 1;
      }),
    );

    this.logger.log(
      `Follower new-upload fanout for ${dto.artistId}: ${notified}/${targets.size}`,
    );
    return { notified, followers: targets.size };
  }

  /**
   * Broadcast an app-update push to all registered mobile devices.
   */
  async broadcastAppUpdate(
    dto: AppUpdateBroadcastDto,
  ): Promise<{ notified: number; devices: number }> {
    const supabase = getSupabaseClient();
    const platform = dto.platform || 'all';
    let query = supabase
      .from('user_device_tokens')
      .select('user_id, fcm_token, device_type')
      .in('device_type', ['ios', 'android']);

    if (platform === 'ios' || platform === 'android') {
      query = query.eq('device_type', platform);
    }

    const { data: tokens, error } = await query;
    if (error) {
      this.logger.error(`Failed to load device tokens: ${error.message}`);
      throw new Error('Failed to load device tokens for broadcast');
    }

    const rows = tokens || [];
    if (rows.length === 0) {
      return { notified: 0, devices: 0 };
    }

    // One push per unique user (prefer first token).
    const byUser = new Map<string, string>();
    for (const row of rows) {
      if (!byUser.has(row.user_id)) {
        byUser.set(row.user_id, row.fcm_token);
      }
    }

    let notified = 0;
    await Promise.allSettled(
      [...byUser.keys()].map(async (userId) => {
        const sent = await this.sendPushNotification({
          userId,
          title: dto.title,
          body: dto.body,
          data: {
            type: 'app_update',
            latestVersion: dto.latestVersion,
            storeUrl: dto.storeUrl || '',
            forceUpdate: dto.forceUpdate ? 'true' : 'false',
            action: 'open_store',
          },
        });
        if (sent) notified += 1;
        else notified += 1; // in-app history still created
      }),
    );

    this.logger.log(
      `App update broadcast: ${notified} users / ${rows.length} devices`,
    );
    return { notified, devices: rows.length };
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
