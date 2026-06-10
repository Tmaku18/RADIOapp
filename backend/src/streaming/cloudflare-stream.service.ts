import { BadRequestException, Injectable, Logger } from '@nestjs/common';

export type CloudflareLiveInputResult = {
  uid: string;
  rtmps?: { url?: string; streamKey?: string };
  webRTC?: { url?: string };
};

export type CloudflareIngestDetails = {
  inputUid: string;
  rtmpUrl: string | null;
  streamKey: string | null;
  webRtcUrl: string | null;
  hlsUrl: string | null;
  watchUrl: string | null;
};

@Injectable()
export class CloudflareStreamService {
  private readonly logger = new Logger(CloudflareStreamService.name);

  buildPlaybackUrls(uid?: string | null): {
    hlsUrl: string | null;
    dashUrl: string | null;
    watchUrl: string | null;
  } {
    const code = (
      process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE ||
      process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN ||
      ''
    ).trim();
    if (!uid || !code) {
      return { hlsUrl: null, dashUrl: null, watchUrl: null };
    }
    const base = `https://customer-${code}.cloudflarestream.com/${uid}`;
    return {
      hlsUrl: `${base}/manifest/video.m3u8`,
      dashUrl: `${base}/manifest/video.mpd`,
      watchUrl: `${base}/iframe`,
    };
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token =
      process.env.CLOUDFLARE_STREAM_API_TOKEN ||
      process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !token) {
      throw new BadRequestException('Cloudflare Stream env vars are missing');
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok || json?.success === false) {
      const message =
        json?.errors?.[0]?.message ||
        `Cloudflare request failed (${res.status})`;
      throw new BadRequestException(message);
    }

    return json?.result as T;
  }

  async createLiveInput(metaName: string): Promise<CloudflareIngestDetails> {
    const created = await this.request<CloudflareLiveInputResult>(
      'POST',
      '/stream/live_inputs',
      {
        meta: { name: metaName },
        recording: { mode: 'automatic' },
      },
    );
    const playback = this.buildPlaybackUrls(created.uid);
    return {
      inputUid: created.uid,
      rtmpUrl: created.rtmps?.url || 'rtmps://live.cloudflare.com:443/live/',
      streamKey: created.rtmps?.streamKey || null,
      webRtcUrl: created.webRTC?.url || null,
      hlsUrl: playback.hlsUrl,
      watchUrl: playback.watchUrl,
    };
  }

  async getLiveInput(uid: string): Promise<CloudflareIngestDetails> {
    try {
      const details = await this.request<CloudflareLiveInputResult>(
        'GET',
        `/stream/live_inputs/${uid}`,
      );
      const playback = this.buildPlaybackUrls(details.uid);
      return {
        inputUid: details.uid,
        rtmpUrl: details.rtmps?.url || 'rtmps://live.cloudflare.com:443/live/',
        streamKey: details.rtmps?.streamKey || null,
        webRtcUrl: details.webRTC?.url || null,
        hlsUrl: playback.hlsUrl,
        watchUrl: playback.watchUrl,
      };
    } catch (e) {
      this.logger.warn(
        `Failed to fetch Cloudflare input ${uid}: ${(e as Error)?.message ?? e}`,
      );
      const playback = this.buildPlaybackUrls(uid);
      return {
        inputUid: uid,
        rtmpUrl: 'rtmps://live.cloudflare.com:443/live/',
        streamKey: null,
        webRtcUrl: null,
        hlsUrl: playback.hlsUrl,
        watchUrl: playback.watchUrl,
      };
    }
  }

  async deleteLiveInput(uid: string): Promise<void> {
    try {
      await this.request('DELETE', `/stream/live_inputs/${uid}`);
    } catch (e) {
      this.logger.warn(
        `Failed to delete Cloudflare input ${uid}: ${(e as Error)?.message ?? e}`,
      );
    }
  }
}
