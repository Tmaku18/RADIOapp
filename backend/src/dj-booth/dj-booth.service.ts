import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { RadioService } from '../radio/radio.service';
import {
  RadioStateService,
  RadioBoothState,
} from '../radio/radio-state.service';
import { normalizeSongStationId } from '../radio/station.constants';
import { CloudflareStreamService } from '../streaming/cloudflare-stream.service';
import { DjBoothRealtimeService } from './dj-booth-realtime.service';

@Injectable()
export class DjBoothService {
  private readonly logger = new Logger(DjBoothService.name);

  constructor(
    private readonly radioService: RadioService,
    private readonly radioStateService: RadioStateService,
    private readonly cloudflareStream: CloudflareStreamService,
    private readonly realtime: DjBoothRealtimeService,
  ) {}

  private normalizeStationId(stationId: string): string {
    return normalizeSongStationId(stationId);
  }

  async getStatus(stationId: string) {
    const radioId = this.normalizeStationId(stationId);
    const [transport, booth, currentTrack, queue] = await Promise.all([
      this.radioStateService.getTransportState(radioId),
      this.radioStateService.getBoothState(radioId),
      this.radioService.getCurrentTrack(radioId).catch(() => null),
      this.radioService.getAdminQueueState(radioId, 25).catch(() => null),
    ]);

    const supabase = getSupabaseClient();
    const { data: session } = await supabase
      .from('dj_booth_sessions')
      .select('*')
      .eq('station_id', radioId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      stationId: radioId,
      transport: transport ?? { paused: false, pausedAt: null, positionSeconds: 0 },
      booth: booth ?? (await this.radioStateService.getDefaultBoothState()),
      session: session ?? null,
      currentTrack,
      queue,
    };
  }

  async getQueue(stationId: string, limit = 25) {
    return this.radioService.getAdminQueueState(
      this.normalizeStationId(stationId),
      limit,
    );
  }

  async replaceQueue(stationId: string, stackIds: string[]) {
    const radioId = this.normalizeStationId(stationId);
    const result = await this.radioService.replaceAdminQueue(radioId, stackIds);
    await this.realtime.broadcast(radioId, { type: 'queue_updated' });
    return result;
  }

  async addQueueEntries(
    stationId: string,
    payload: {
      items: Array<{ stackId?: string; songId?: string; source?: 'songs' }>;
      position?: number;
      allowDuplicates?: boolean;
    },
  ) {
    const radioId = this.normalizeStationId(stationId);
    const result = await this.radioService.addAdminQueueEntries(radioId, payload);
    await this.realtime.broadcast(radioId, { type: 'queue_updated' });
    return result;
  }

  async removeQueueEntry(
    stationId: string,
    params: {
      position?: number;
      stackId?: string;
      songId?: string;
      source?: 'songs';
    },
  ) {
    const radioId = this.normalizeStationId(stationId);
    const result = await this.radioService.removeAdminQueueEntry(radioId, params);
    await this.realtime.broadcast(radioId, { type: 'queue_updated' });
    return result;
  }

  async skipForward(stationId: string) {
    const radioId = this.normalizeStationId(stationId);
    const result = await this.radioService.getNextTrack(radioId, true);
    await this.realtime.broadcast(radioId, { type: 'queue_updated' });
    return result;
  }

  async skipBack(stationId: string) {
    const radioId = this.normalizeStationId(stationId);
    const result = await this.radioService.skipBackForStation(radioId);
    await this.realtime.broadcast(radioId, { type: 'queue_updated' });
    return result;
  }

  async pauseTransport(stationId: string) {
    const radioId = this.normalizeStationId(stationId);
    const positionSeconds =
      await this.radioService.pauseTransportForStation(radioId);
    await this.realtime.broadcast(radioId, {
      type: 'transport_pause',
      positionSeconds,
    });
    return { paused: true, positionSeconds };
  }

  async playTransport(stationId: string) {
    const radioId = this.normalizeStationId(stationId);
    const positionSeconds =
      await this.radioService.resumeTransportForStation(radioId);
    await this.realtime.broadcast(radioId, {
      type: 'transport_play',
      positionSeconds,
    });
    return { paused: false, positionSeconds };
  }

  async createMicSession(stationId: string, adminUserId: string) {
    const radioId = this.normalizeStationId(stationId);
    const supabase = getSupabaseClient();

    await supabase
      .from('dj_booth_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('station_id', radioId)
      .eq('status', 'active');

    const ingest = await this.cloudflareStream.createLiveInput(
      `dj-booth-${radioId}`,
    );

    const { data: session, error } = await supabase
      .from('dj_booth_sessions')
      .insert({
        station_id: radioId,
        admin_user_id: adminUserId,
        cloudflare_uid: ingest.inputUid,
        whip_url: ingest.webRtcUrl,
        hls_playback_url: ingest.hlsUrl,
        status: 'active',
      })
      .select('*')
      .single();

    if (error || !session) {
      await this.cloudflareStream.deleteLiveInput(ingest.inputUid);
      throw new BadRequestException(
        `Failed to create DJ booth session: ${error?.message ?? 'unknown'}`,
      );
    }

    const booth: RadioBoothState = {
      micActive: true,
      duckVolume: 0.25,
      hlsUrl: ingest.hlsUrl,
      sessionId: session.id,
    };
    await this.radioStateService.setBoothState(booth, radioId);
    await this.realtime.broadcast(radioId, {
      type: 'mic_on',
      duckVolume: booth.duckVolume,
      hlsUrl: ingest.hlsUrl,
    });

    return {
      sessionId: session.id,
      whipUrl: ingest.webRtcUrl,
      hlsPlaybackUrl: ingest.hlsUrl,
      rtmpUrl: ingest.rtmpUrl,
      streamKey: ingest.streamKey,
    };
  }

  async deleteMicSession(stationId: string) {
    const radioId = this.normalizeStationId(stationId);
    const supabase = getSupabaseClient();

    const { data: session } = await supabase
      .from('dj_booth_sessions')
      .select('*')
      .eq('station_id', radioId)
      .eq('status', 'active')
      .maybeSingle();

    if (session?.cloudflare_uid) {
      await this.cloudflareStream.deleteLiveInput(session.cloudflare_uid);
    }

    if (session) {
      await supabase
        .from('dj_booth_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', session.id);
    }

    await this.radioStateService.clearBoothState(radioId);
    await this.realtime.broadcast(radioId, { type: 'mic_off' });

    return { ended: true };
  }

  async micOn(stationId: string) {
    const radioId = this.normalizeStationId(stationId);
    const booth =
      (await this.radioStateService.getBoothState(radioId)) ??
      (await this.radioStateService.getDefaultBoothState());

    if (!booth.hlsUrl) {
      throw new BadRequestException('Connect mic session first');
    }

    booth.micActive = true;
    await this.radioStateService.setBoothState(booth, radioId);
    await this.realtime.broadcast(radioId, {
      type: 'mic_on',
      duckVolume: booth.duckVolume,
      hlsUrl: booth.hlsUrl,
    });

    return { micActive: true, duckVolume: booth.duckVolume };
  }

  async micOff(stationId: string) {
    const radioId = this.normalizeStationId(stationId);
    const booth = await this.radioStateService.getBoothState(radioId);
    if (booth) {
      booth.micActive = false;
      await this.radioStateService.setBoothState(booth, radioId);
    }
    await this.realtime.broadcast(radioId, { type: 'mic_off' });
    return { micActive: false };
  }

  async setDuckVolume(stationId: string, duckVolume: number) {
    const radioId = this.normalizeStationId(stationId);
    const v = Math.max(0.05, Math.min(0.8, duckVolume));
    const booth =
      (await this.radioStateService.getBoothState(radioId)) ??
      (await this.radioStateService.getDefaultBoothState());
    booth.duckVolume = v;
    await this.radioStateService.setBoothState(booth, radioId);
    await this.realtime.broadcast(radioId, { type: 'duck_volume', duckVolume: v });
    return { duckVolume: v };
  }

  async listSoundboardClips() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('dj_soundboard_clips')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      throw new BadRequestException(error.message);
    }
    return (data ?? []).map((row) => this.clipToPublic(row));
  }

  private clipToPublic(row: Record<string, unknown>) {
    const supabase = getSupabaseClient();
    const path = String(row.storage_path ?? '');
    const { data } = supabase.storage.from('dj-soundboard').getPublicUrl(path);
    return {
      id: row.id,
      name: row.name,
      durationSeconds: row.duration_seconds,
      clipUrl: data.publicUrl,
      createdAt: row.created_at,
    };
  }

  async registerSoundboardClip(
    adminUserId: string,
    payload: { name: string; storagePath: string; durationSeconds?: number },
  ) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('dj_soundboard_clips')
      .insert({
        uploaded_by: adminUserId,
        name: payload.name.trim().slice(0, 80),
        storage_path: payload.storagePath.replace(/^\/+/, ''),
        duration_seconds: Math.min(
          30,
          Math.max(1, payload.durationSeconds ?? 5),
        ),
      })
      .select('*')
      .single();
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Failed to save clip');
    }
    return this.clipToPublic(data);
  }

  async createSoundboardUploadUrl(
    adminUserId: string,
    payload: { fileName: string; contentType: string },
  ) {
    const ext = payload.fileName.split('.').pop()?.toLowerCase() || 'mp3';
    const path = `${adminUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from('dj-soundboard')
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Upload URL failed');
    }
    return { path, signedUrl: data.signedUrl, token: data.token };
  }

  async deleteSoundboardClip(clipId: string) {
    const supabase = getSupabaseClient();
    const { data: clip } = await supabase
      .from('dj_soundboard_clips')
      .select('storage_path')
      .eq('id', clipId)
      .maybeSingle();
    if (!clip) throw new NotFoundException('Clip not found');
    await supabase.storage.from('dj-soundboard').remove([clip.storage_path]);
    await supabase.from('dj_soundboard_clips').delete().eq('id', clipId);
    return { deleted: true };
  }

  async playSoundboardClip(stationId: string, clipId: string) {
    const radioId = this.normalizeStationId(stationId);
    const supabase = getSupabaseClient();
    const { data: clip } = await supabase
      .from('dj_soundboard_clips')
      .select('*')
      .eq('id', clipId)
      .maybeSingle();
    if (!clip) throw new NotFoundException('Clip not found');
    const publicClip = this.clipToPublic(clip);
    await this.realtime.broadcast(radioId, {
      type: 'soundboard_play',
      clipId: String(clip.id),
      clipUrl: publicClip.clipUrl,
      clipName: String(clip.name),
      durationSeconds: Number(clip.duration_seconds) || 5,
    });
    return publicClip;
  }
}
