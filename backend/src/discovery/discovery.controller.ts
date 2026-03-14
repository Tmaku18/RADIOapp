import {
  BadRequestException,
  Body,
  Controller,
  Get,
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

@Controller('discovery')
@UseGuards(FirebaseAuthGuard)
export class DiscoveryController {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly uploads: UploadsService,
  ) {}

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
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 20, 50) : undefined;
    const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10)) : undefined;
    const minRateCents = minRateCentsStr != null ? parseInt(minRateCentsStr, 10) : undefined;
    const maxRateCents = maxRateCentsStr != null ? parseInt(maxRateCentsStr, 10) : undefined;
    const lat = latStr != null ? parseFloat(latStr) : undefined;
    const lng = lngStr != null ? parseFloat(lngStr) : undefined;
    const radiusKm = radiusKmStr != null ? parseFloat(radiusKmStr) : undefined;
    const radiusKmVal = typeof radiusKm === 'number' && Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : undefined;
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

  /** Endless-scroll feed of catalyst posts (Discover tab) */
  @Get('feed')
  async listFeed(
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 20, 50) : undefined;
    return this.discovery.listFeedPosts({ limit, cursor: cursor || undefined });
  }

  /** Create a discover feed post (Catalysts only). Send image as "file" and optional "caption" in body. */
  @Post('feed')
  @UseGuards(RolesGuard)
  @Roles('service_provider', 'admin')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async createFeedPost(
    @CurrentUser() user: FirebaseUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { caption?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Send an image in the "file" field.');
    }
    const userId = await this.getUserId(user.uid);
    const imageUrl = await this.uploads.uploadFeedPostImage(file, userId);
    return this.discovery.createFeedPost({
      authorUserId: userId,
      imageUrl,
      caption: body?.caption?.trim() || null,
    });
  }

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return data.id;
  }
}
