import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getFirebaseAuth } from '../config/firebase.config';
import { ArtistLiveService } from './artist-live.service';
import { StartLiveDto } from './dto/start-live.dto';
import { JoinLiveDto } from './dto/join-live.dto';
import { CloudflareWebhookDto } from './dto/cloudflare-webhook.dto';

@Controller('artist-live')
export class ArtistLiveController {
  constructor(private readonly artistLive: ArtistLiveService) {}

  @Post('start')
  async startLive(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: StartLiveDto,
  ) {
    return this.artistLive.startLive(user.uid, dto);
  }

  @Post('stop')
  async stopLive(@CurrentUser() user: FirebaseUser) {
    return this.artistLive.stopLive(user.uid);
  }

  @Get(':artistId/status')
  @Public()
  async getStatus(@Param('artistId') artistId: string) {
    return this.artistLive.getArtistStatus(artistId);
  }

  @Get(':artistId/watch')
  @Public()
  async getWatch(@Param('artistId') artistId: string) {
    return this.artistLive.getWatchInfo(artistId);
  }

  @Public()
  @Post(':sessionId/join')
  async join(
    @Param('sessionId') sessionId: string,
    @Body() dto: JoinLiveDto,
    @Headers('authorization') authorization?: string,
  ) {
    let firebaseUid: string | undefined;
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.substring(7);
      try {
        const decoded = await getFirebaseAuth().verifyIdToken(token);
        firebaseUid = decoded.uid;
      } catch {
        throw new UnauthorizedException('Invalid token');
      }
    }
    return this.artistLive.joinSession(sessionId, dto.source, firebaseUid);
  }

  @Public()
  @Post('webhook')
  async processWebhook(
    @Body() body: CloudflareWebhookDto,
    @Headers('x-webhook-secret') webhookSecret?: string,
  ) {
    const expected = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
    if (expected && webhookSecret !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const inputId = body.data?.input_id;
    const eventType = body.data?.event_type;
    const videoUid =
      typeof body.data?.video_uid === 'string'
        ? body.data.video_uid
        : typeof body.data?.videoUid === 'string'
          ? body.data.videoUid
          : undefined;

    return this.artistLive.processCloudflareWebhook({
      inputId,
      eventType,
      videoUid,
      raw: body,
    });
  }

  @Post(':sessionId/donations/intent')
  async createDonationIntent(
    @CurrentUser() user: FirebaseUser,
    @Param('sessionId') sessionId: string,
    @Body() body: { amountCents: number; message?: string },
  ) {
    return this.artistLive.createDonationIntent(user.uid, sessionId, body);
  }

  @Post(':sessionId/report')
  async reportStream(
    @CurrentUser() user: FirebaseUser,
    @Param('sessionId') sessionId: string,
    @Body() body: { reason: string },
  ) {
    return this.artistLive.reportStream(
      user.uid,
      sessionId,
      body.reason || 'unspecified',
    );
  }

  @Post('admin/sessions/:sessionId/force-stop')
  @Roles('admin')
  async adminForceStop(@Param('sessionId') sessionId: string) {
    return this.artistLive.adminForceStopSession(sessionId);
  }

  @Post('admin/artists/:artistId/ban')
  @Roles('admin')
  async adminBanArtist(
    @Param('artistId') artistId: string,
    @Body() body: { banned: boolean },
  ) {
    return this.artistLive.adminSetArtistLiveBan(
      artistId,
      body.banned === true,
    );
  }

  @Public()
  @Post(':sessionId/ads/impression')
  async trackAdImpression(
    @Param('sessionId') sessionId: string,
    @Headers('authorization') authorization?: string,
  ) {
    let firebaseUid: string | undefined;
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.substring(7);
      try {
        const decoded = await getFirebaseAuth().verifyIdToken(token);
        firebaseUid = decoded.uid;
      } catch {
        firebaseUid = undefined;
      }
    }
    return this.artistLive.trackAdImpression(sessionId, firebaseUid);
  }
}
