import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { PushNotificationService } from '../push-notifications/push-notification.service';

export type AppPlatform = 'ios' | 'android' | 'all';

export interface PublishAppReleaseDto {
  platform?: AppPlatform;
  latestVersion: string;
  latestBuild?: number;
  minVersion?: string;
  title?: string;
  body?: string;
  storeUrl?: string;
  forceUpdate?: boolean;
  broadcastPush?: boolean;
  createdBy?: string;
}

@Injectable()
export class AppVersionService {
  private readonly logger = new Logger(AppVersionService.name);

  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * Public: latest published release for a platform (falls back to `all`).
   */
  async getLatestForPlatform(platform: 'ios' | 'android') {
    const supabase = getSupabaseClient();

    const { data: exact, error: exactError } = await supabase
      .from('app_releases')
      .select('*')
      .in('platform', [platform, 'all'])
      .order('created_at', { ascending: false })
      .limit(8);

    if (exactError) {
      this.logger.warn(`app_releases lookup failed: ${exactError.message}`);
      return {
        latestVersion: null,
        latestBuild: null,
        minVersion: null,
        title: null,
        body: null,
        storeUrl: null,
        forceUpdate: false,
      };
    }

    const rows = exact || [];
    const preferred =
      rows.find((r) => r.platform === platform) ||
      rows.find((r) => r.platform === 'all') ||
      null;

    if (!preferred) {
      return {
        latestVersion: null,
        latestBuild: null,
        minVersion: null,
        title: null,
        body: null,
        storeUrl: null,
        forceUpdate: false,
      };
    }

    return {
      latestVersion: preferred.latest_version as string,
      latestBuild: preferred.latest_build as number | null,
      minVersion: (preferred.min_version as string | null) ?? null,
      title: preferred.title as string,
      body: preferred.body as string,
      storeUrl: (preferred.store_url as string | null) ?? null,
      forceUpdate: preferred.force_update === true,
      platform: preferred.platform as AppPlatform,
      publishedAt: preferred.created_at as string,
    };
  }

  async publishRelease(dto: PublishAppReleaseDto) {
    const version = (dto.latestVersion || '').trim();
    if (!version) {
      throw new BadRequestException('latestVersion is required');
    }

    const platform: AppPlatform = dto.platform || 'all';
    const title = (dto.title || 'Update available').trim();
    const body = (
      dto.body ||
      `NETWORX Radio ${version} is ready. Update to get the latest features.`
    ).trim();

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('app_releases')
      .insert({
        platform,
        latest_version: version,
        latest_build: dto.latestBuild ?? null,
        min_version: dto.minVersion?.trim() || null,
        title,
        body,
        store_url: dto.storeUrl?.trim() || null,
        force_update: dto.forceUpdate === true,
        broadcast_push: dto.broadcastPush === true,
        created_by: dto.createdBy || null,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to publish app release: ${error.message}`);
      throw new BadRequestException(
        `Failed to publish app release: ${error.message}`,
      );
    }

    let broadcast: { notified: number; devices: number } | null = null;
    if (dto.broadcastPush) {
      broadcast = await this.pushNotificationService.broadcastAppUpdate({
        title,
        body,
        latestVersion: version,
        storeUrl: dto.storeUrl,
        forceUpdate: dto.forceUpdate,
        platform,
      });
      await supabase
        .from('app_releases')
        .update({ broadcast_at: new Date().toISOString() })
        .eq('id', data.id);
    }

    return { release: data, broadcast };
  }
}
