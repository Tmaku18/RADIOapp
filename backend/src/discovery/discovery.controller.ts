import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DiscoveryService } from './discovery.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { UploadsService } from '../uploads/uploads.service';
import { DurationService } from '../uploads/duration.service';
import { ProNetworkSubscriptionService } from '../pro-network-subscription/pro-network-subscription.service';
import { PRO_NETWORK_PAYWALL_PAYLOAD } from '../pro-network-subscription/pro-network-subscription.constants';

@Controller('discovery')
@UseGuards(FirebaseAuthGuard)
export class DiscoveryController {
  private readonly allowedFeedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ];
  private readonly maxFeedVideoDurationSeconds = 15;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly uploads: UploadsService,
    private readonly durationService: DurationService,
    private readonly proNetworkSubscription: ProNetworkSubscriptionService,
  ) {}

  /** Discoverable people with city/ZIP for map pins + directory lists. */
  @Get('people/directory')
  async listPeopleDirectory(
    @CurrentUser() user: FirebaseUser,
    @Query('lat') latStr?: string,
    @Query('lng') lngStr?: string,
    @Query('radiusKm') radiusKmStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    const lat = latStr != null ? parseFloat(latStr) : undefined;
    const lng = lngStr != null ? parseFloat(lngStr) : undefined;
    const radiusKm = radiusKmStr != null ? parseFloat(radiusKmStr) : undefined;
    const limit = limitStr
      ? Math.min(parseInt(limitStr, 10) || 200, 500)
      : undefined;
    return this.discovery.listPeopleDirectory({
      viewerUserId,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      radiusKm:
        typeof radiusKm === 'number' &&
        Number.isFinite(radiusKm) &&
        radiusKm > 0
          ? radiusKm
          : undefined,
      limit,
    });
  }

  @Get('people')
  async listPeople(
    @CurrentUser() user: FirebaseUser,
    @Query('serviceType') serviceType?: string,
    @Query('location') location?: string,
    @Query('search') search?: string,
    @Query('role') role?: 'artist' | 'service_provider' | 'all',
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('minRateCents') minRateCentsStr?: string,
    @Query('maxRateCents') maxRateCentsStr?: string,
    @Query('lat') latStr?: string,
    @Query('lng') lngStr?: string,
    @Query('radiusKm') radiusKmStr?: string,
    @Query('mode') mode?: 'default' | 'random',
    @Query('seed') seed?: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    const limit = limitStr
      ? Math.min(parseInt(limitStr, 10) || 20, 50)
      : undefined;
    const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10)) : undefined;
    const minRateCents =
      minRateCentsStr != null ? parseInt(minRateCentsStr, 10) : undefined;
    const maxRateCents =
      maxRateCentsStr != null ? parseInt(maxRateCentsStr, 10) : undefined;
    const lat = latStr != null ? parseFloat(latStr) : undefined;
    const lng = lngStr != null ? parseFloat(lngStr) : undefined;
    const radiusKm = radiusKmStr != null ? parseFloat(radiusKmStr) : undefined;
    const radiusKmVal =
      typeof radiusKm === 'number' && Number.isFinite(radiusKm) && radiusKm > 0
        ? radiusKm
        : undefined;
    return this.discovery.listPeople({
      viewerUserId,
      serviceType,
      location,
      search,
      role: role ?? 'all',
      mode: mode ?? 'default',
      seed,
      limit,
      offset,
      minRateCents: Number.isFinite(minRateCents) ? minRateCents : undefined,
      maxRateCents: Number.isFinite(maxRateCents) ? maxRateCents : undefined,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      radiusKm: radiusKmVal,
    });
  }

  /**
   * Endless-scroll feed of catalyst/creative posts. Powers both the Networks
   * Radio Social tab (scope=all) and Pro Networks Home (scope=following).
   */
  @Get('feed')
  async listFeed(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
    @Query('scope') scope?: 'all' | 'following',
  ) {
    const limit = limitStr
      ? Math.min(parseInt(limitStr, 10) || 20, 50)
      : undefined;
    const viewerUserId = await this.getUserId(user.uid);
    return this.discovery.listFeedPosts({
      limit,
      cursor: cursor || undefined,
      viewerUserId,
      scope: scope === 'following' ? 'following' : 'all',
    });
  }

  /** Like a feed post (idempotent). */
  @Post('feed/posts/:id/like')
  async likePost(
    @CurrentUser() user: FirebaseUser,
    @Param('id') postId: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    await this.discovery.likePost(viewerUserId, postId);
    return { ok: true };
  }

  /** Unlike a feed post. */
  @Delete('feed/posts/:id/like')
  async unlikePost(
    @CurrentUser() user: FirebaseUser,
    @Param('id') postId: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    await this.discovery.unlikePost(viewerUserId, postId);
    return { ok: true };
  }

  /** Delete a feed post (author or admin). */
  @Delete('feed/posts/:id')
  async deleteFeedPost(
    @CurrentUser() user: FirebaseUser,
    @Param('id') postId: string,
  ) {
    const requester = await this.getUserWithRole(user.uid);
    try {
      return await this.discovery.deleteFeedPost({
        postId,
        requesterUserId: requester.id,
        isAdmin: requester.role === 'admin',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete';
      if (message === 'Post not found') {
        throw new BadRequestException('Post not found');
      }
      if (message === 'Forbidden') {
        throw new ForbiddenException('You can only delete your own posts');
      }
      throw new BadRequestException(message);
    }
  }

  /** Bookmark (save) a feed post (idempotent). */
  @Post('feed/posts/:id/bookmark')
  async bookmarkPost(
    @CurrentUser() user: FirebaseUser,
    @Param('id') postId: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    await this.discovery.bookmarkPost(viewerUserId, postId);
    return { ok: true };
  }

  /** Remove a bookmark. */
  @Delete('feed/posts/:id/bookmark')
  async unbookmarkPost(
    @CurrentUser() user: FirebaseUser,
    @Param('id') postId: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    await this.discovery.unbookmarkPost(viewerUserId, postId);
    return { ok: true };
  }

  /** Report a feed post for moderation review. */
  @Post('feed/posts/:id/report')
  async reportPost(
    @CurrentUser() user: FirebaseUser,
    @Param('id') postId: string,
    @Body() body: { reason?: string },
  ) {
    const reason = (body?.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('Report reason is required');
    }
    const viewerUserId = await this.getUserId(user.uid);
    return this.discovery.reportPost(viewerUserId, postId, reason);
  }

  /** Posts the viewer has saved (Saved screen). */
  @Get('feed/bookmarks')
  async listBookmarks(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    const limit = limitStr
      ? Math.min(parseInt(limitStr, 10) || 24, 60)
      : undefined;
    return this.discovery.listBookmarkedPosts({
      viewerUserId,
      limit,
      cursor: cursor || undefined,
    });
  }

  /** Posts the viewer has liked (Liked screen). */
  @Get('feed/liked')
  async listLiked(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    const limit = limitStr
      ? Math.min(parseInt(limitStr, 10) || 24, 60)
      : undefined;
    return this.discovery.listLikedPosts({
      viewerUserId,
      limit,
      cursor: cursor || undefined,
    });
  }

  /** List comments on a feed post. */
  @Get('feed/posts/:id/comments')
  async listComments(
    @Param('id') postId: string,
    @Query('limit') limitStr?: string,
    @Query('before') before?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) || 50 : 50;
    return {
      items: await this.discovery.listComments(postId, limit, before),
    };
  }

  /** Add a comment to a feed post. Requires a Pro-Networx subscription. */
  @Post('feed/posts/:id/comments')
  async createComment(
    @CurrentUser() user: FirebaseUser,
    @Param('id') postId: string,
    @Body() body: { body?: string },
  ) {
    const text = (body?.body ?? '').trim();
    if (!text) {
      throw new BadRequestException('Comment body required');
    }
    const viewerUserId = await this.getUserId(user.uid);
    // Commenting on the creative feed is a paid Pro-Networx feature. Reading
    // comments stays free for everyone (see listComments above).
    const access = await this.proNetworkSubscription.getAccess(viewerUserId);
    if (!access.hasAccess) {
      throw new ForbiddenException(PRO_NETWORK_PAYWALL_PAYLOAD);
    }
    return this.discovery.createComment(viewerUserId, postId, text);
  }

  /** Soft-delete a comment authored by the viewer. */
  @Delete('feed/comments/:id')
  async deleteComment(
    @CurrentUser() user: FirebaseUser,
    @Param('id') commentId: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    await this.discovery.deleteComment(viewerUserId, commentId);
    return { ok: true };
  }

  /** Top-results search across people + posts. */
  @Get('feed/search')
  async searchFeed(
    @CurrentUser() user: FirebaseUser,
    @Query('q') q?: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    return this.discovery.searchTop((q ?? '').trim(), viewerUserId);
  }

  /** Default-state Search tab tile grid (random recent top posts). */
  @Get('feed/explore')
  async exploreTiles(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limitStr?: string,
    @Query('seed') seed?: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    const limit = limitStr
      ? Math.min(parseInt(limitStr, 10) || 60, 120)
      : undefined;
    return this.discovery.listExploreTiles({
      viewerUserId,
      limit,
      seed,
    });
  }

  /** Posts authored by a single user (Pro Networks portfolio grid). */
  @Get('feed/users/:userId/posts')
  async listUserPosts(
    @CurrentUser() user: FirebaseUser,
    @Param('userId') authorUserId: string,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    const limit = limitStr
      ? Math.min(parseInt(limitStr, 10) || 24, 60)
      : undefined;
    return this.discovery.listPostsByAuthor({
      authorUserId,
      viewerUserId,
      limit,
      cursor: cursor || undefined,
    });
  }

  /** Endless vertical scroll on Search tab once a tile is tapped. */
  @Get('feed/explore-stream')
  async exploreStream(
    @CurrentUser() user: FirebaseUser,
    @Query('cursor') cursor?: string,
    @Query('anchorPostId') anchorPostId?: string,
    @Query('limit') limitStr?: string,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    const limit = limitStr
      ? Math.min(parseInt(limitStr, 10) || 12, 30)
      : undefined;
    return this.discovery.streamExplore({
      viewerUserId,
      cursor: cursor ?? null,
      anchorPostId: anchorPostId ?? null,
      limit,
    });
  }

  @Get('map/heat')
  async getMapHeat(
    @Query('station') station?: string,
    @Query('role') role?: 'artist' | 'service_provider' | 'all',
    @Query('zoom') zoomStr?: string,
    @Query('minLat') minLatStr?: string,
    @Query('maxLat') maxLatStr?: string,
    @Query('minLng') minLngStr?: string,
    @Query('maxLng') maxLngStr?: string,
  ) {
    const zoom = zoomStr != null ? Number.parseInt(zoomStr, 10) : undefined;
    const minLat = minLatStr != null ? Number.parseFloat(minLatStr) : undefined;
    const maxLat = maxLatStr != null ? Number.parseFloat(maxLatStr) : undefined;
    const minLng = minLngStr != null ? Number.parseFloat(minLngStr) : undefined;
    const maxLng = maxLngStr != null ? Number.parseFloat(maxLngStr) : undefined;
    return this.discovery.getMapHeat({
      stationId: station?.trim() || undefined,
      role: role ?? 'all',
      zoom: Number.isFinite(zoom) ? zoom : undefined,
      minLat: Number.isFinite(minLat) ? minLat : undefined,
      maxLat: Number.isFinite(maxLat) ? maxLat : undefined,
      minLng: Number.isFinite(minLng) ? minLng : undefined,
      maxLng: Number.isFinite(maxLng) ? maxLng : undefined,
    });
  }

  @Get('map/clusters')
  async getMapClusters(
    @Query('station') station?: string,
    @Query('role') role?: 'artist' | 'service_provider' | 'all',
    @Query('zoom') zoomStr?: string,
    @Query('minLat') minLatStr?: string,
    @Query('maxLat') maxLatStr?: string,
    @Query('minLng') minLngStr?: string,
    @Query('maxLng') maxLngStr?: string,
  ) {
    const zoom = zoomStr != null ? Number.parseInt(zoomStr, 10) : undefined;
    const minLat = minLatStr != null ? Number.parseFloat(minLatStr) : undefined;
    const maxLat = maxLatStr != null ? Number.parseFloat(maxLatStr) : undefined;
    const minLng = minLngStr != null ? Number.parseFloat(minLngStr) : undefined;
    const maxLng = maxLngStr != null ? Number.parseFloat(maxLngStr) : undefined;
    return this.discovery.getMapClusters({
      stationId: station?.trim() || undefined,
      role: role ?? 'all',
      zoom: Number.isFinite(zoom) ? zoom : undefined,
      minLat: Number.isFinite(minLat) ? minLat : undefined,
      maxLat: Number.isFinite(maxLat) ? maxLat : undefined,
      minLng: Number.isFinite(minLng) ? minLng : undefined,
      maxLng: Number.isFinite(maxLng) ? maxLng : undefined,
    });
  }

  @Get('map/artists')
  async getMapArtists(
    @Query('station') station?: string,
    @Query('role') role?: 'artist' | 'service_provider' | 'all',
    @Query('minLat') minLatStr?: string,
    @Query('maxLat') maxLatStr?: string,
    @Query('minLng') minLngStr?: string,
    @Query('maxLng') maxLngStr?: string,
    @Query('clusterLat') clusterLatStr?: string,
    @Query('clusterLng') clusterLngStr?: string,
    @Query('clusterRadiusKm') clusterRadiusKmStr?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const minLat = minLatStr != null ? Number.parseFloat(minLatStr) : undefined;
    const maxLat = maxLatStr != null ? Number.parseFloat(maxLatStr) : undefined;
    const minLng = minLngStr != null ? Number.parseFloat(minLngStr) : undefined;
    const maxLng = maxLngStr != null ? Number.parseFloat(maxLngStr) : undefined;
    const clusterLat =
      clusterLatStr != null ? Number.parseFloat(clusterLatStr) : undefined;
    const clusterLng =
      clusterLngStr != null ? Number.parseFloat(clusterLngStr) : undefined;
    const clusterRadiusKm =
      clusterRadiusKmStr != null
        ? Number.parseFloat(clusterRadiusKmStr)
        : undefined;
    const limit = limitStr != null ? Number.parseInt(limitStr, 10) : undefined;
    const offset =
      offsetStr != null ? Number.parseInt(offsetStr, 10) : undefined;
    return this.discovery.getMapArtists({
      stationId: station?.trim() || undefined,
      role: role ?? 'all',
      minLat: Number.isFinite(minLat) ? minLat : undefined,
      maxLat: Number.isFinite(maxLat) ? maxLat : undefined,
      minLng: Number.isFinite(minLng) ? minLng : undefined,
      maxLng: Number.isFinite(maxLng) ? maxLng : undefined,
      clusterLat: Number.isFinite(clusterLat) ? clusterLat : undefined,
      clusterLng: Number.isFinite(clusterLng) ? clusterLng : undefined,
      clusterRadiusKm: Number.isFinite(clusterRadiusKm)
        ? clusterRadiusKm
        : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
  }

  /**
   * Create a discover feed post (image or ≤15s video).
   * Listeners may post TikTok-style videos synced to a liked Discover clip;
   * artists, Catalysts, and admins may also post.
   * Send image/video as "file" and optional "caption" in body.
   */
  @Post('feed')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 75 * 1024 * 1024 }, // 75MB — room for 15s phone videos
    }),
  )
  async createFeedPost(
    @CurrentUser() user: FirebaseUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { caption?: string },
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send an image or video in the "file" field.',
      );
    }
    if (!this.allowedFeedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Allowed: JPG, PNG, WEBP, MP4, WEBM, MOV.',
      );
    }

    const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
    if (mediaType === 'video') {
      // Camera / mirrored exports often lack parseable duration metadata.
      // Never treat "unknown" as 180s — that falsely rejects every short take.
      const durationSeconds = await this.durationService.extractDurationOrNull(
        file.buffer,
        file.mimetype,
      );
      // +1s slack for encoder/timer rounding on a 15s cap.
      if (
        durationSeconds != null &&
        durationSeconds > this.maxFeedVideoDurationSeconds + 1
      ) {
        throw new BadRequestException(
          `Video length must be ${this.maxFeedVideoDurationSeconds} seconds or less.`,
        );
      }
    }

    const userId = await this.getUserId(user.uid);
    const imageUrl = await this.uploads.uploadFeedPostMedia(file, userId);
    return this.discovery.createFeedPost({
      authorUserId: userId,
      imageUrl,
      mediaType,
      caption: body?.caption?.trim() || null,
    });
  }

  private async getUserId(firebaseUid: string): Promise<string> {
    const row = await this.getUserWithRole(firebaseUid);
    return row.id;
  }

  private async getUserWithRole(
    firebaseUid: string,
  ): Promise<{ id: string; role: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return { id: data.id as string, role: (data.role as string) ?? null };
  }
}
