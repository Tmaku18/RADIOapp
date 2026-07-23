import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getFirebaseAuth } from '../config/firebase.config';
import { ArtistLiveService } from './artist-live.service';
import { StartLiveDto } from './dto/start-live.dto';
import { JoinLiveDto, ViewerPresenceDto } from './dto/join-live.dto';
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

  /** Broadcaster confirms WHIP/RTMP is publishing (promotes starting → live). */
  @Post('publishing')
  async markPublishing(
    @CurrentUser() user: FirebaseUser,
    @Body() body?: { sessionId?: string },
  ) {
    return this.artistLive.markPublishing(user.uid, body?.sessionId);
  }

  @Get('sessions')
  @Public()
  async listSessions() {
    return this.artistLive.listLiveSessions();
  }

  @Get('streamer-status')
  async getStreamerStatus(@CurrentUser() user: FirebaseUser) {
    return this.artistLive.getStreamerStatus(user.uid);
  }

  @Post('apply')
  async applyToStream(@CurrentUser() user: FirebaseUser) {
    return this.artistLive.applyToStream(user.uid);
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
    return this.artistLive.joinSession(
      sessionId,
      dto.source,
      firebaseUid,
      dto.viewerToken,
    );
  }

  @Public()
  @Post(':sessionId/heartbeat')
  async heartbeat(
    @Param('sessionId') sessionId: string,
    @Body() dto: ViewerPresenceDto,
  ) {
    return this.artistLive.heartbeat(sessionId, dto.viewerId);
  }

  @Public()
  @Post(':sessionId/leave')
  async leave(
    @Param('sessionId') sessionId: string,
    @Body() dto: ViewerPresenceDto,
  ) {
    return this.artistLive.leaveSession(sessionId, dto.viewerId);
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
    @Headers('x-client-platform') platform?: string,
  ) {
    return this.artistLive.createDonationIntent(user.uid, sessionId, {
      ...body,
      platform,
    });
  }

  @Post(':sessionId/donations/checkout')
  async createDonationCheckout(
    @CurrentUser() user: FirebaseUser,
    @Param('sessionId') sessionId: string,
    @Body() body: { amountCents: number; message?: string },
  ) {
    return this.artistLive.createDonationCheckout(user.uid, sessionId, body);
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

  @Public()
  @Get(':sessionId/chat')
  async listChat(
    @Param('sessionId') sessionId: string,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.artistLive.listChatMessages(sessionId, {
      after: after || undefined,
      limit:
        parsedLimit && Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Post(':sessionId/chat')
  async postChat(
    @CurrentUser() user: FirebaseUser,
    @Param('sessionId') sessionId: string,
    @Body() body: { message: string },
  ) {
    return this.artistLive.postChatMessage(user.uid, sessionId, body.message);
  }

  @Post(':sessionId/chat/:messageId/delete')
  async deleteChat(
    @CurrentUser() user: FirebaseUser,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.artistLive.deleteChatMessage(user.uid, sessionId, messageId);
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
