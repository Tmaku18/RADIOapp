import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { DjBoothService } from './dj-booth.service';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('admin/dj-booth')
@Roles('admin')
export class DjBoothController {
  constructor(private readonly djBoothService: DjBoothService) {}

  private async getAdminDbId(req: { user?: { uid?: string } }): Promise<string> {
    const firebaseUid = req.user?.uid;
    if (!firebaseUid) throw new Error('Unauthorized');
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (!data?.id) throw new Error('Admin user not found');
    return data.id;
  }

  @Get('soundboard/clips')
  listSoundboardClips() {
    return this.djBoothService.listSoundboardClips();
  }

  @Post('soundboard/upload-url')
  async createSoundboardUploadUrl(
    @Req() req: { user?: { uid?: string } },
    @Body() body: { fileName: string; contentType: string },
  ) {
    const adminUserId = await this.getAdminDbId(req);
    return this.djBoothService.createSoundboardUploadUrl(adminUserId, body);
  }

  @Post('soundboard/clips')
  async registerSoundboardClip(
    @Req() req: { user?: { uid?: string } },
    @Body()
    body: { name: string; storagePath: string; durationSeconds?: number },
  ) {
    const adminUserId = await this.getAdminDbId(req);
    return this.djBoothService.registerSoundboardClip(adminUserId, body);
  }

  @Delete('soundboard/clips/:clipId')
  deleteSoundboardClip(@Param('clipId') clipId: string) {
    return this.djBoothService.deleteSoundboardClip(clipId);
  }

  @Get(':stationId')
  getStatus(@Param('stationId') stationId: string) {
    return this.djBoothService.getStatus(stationId);
  }

  @Get(':stationId/queue')
  getQueue(
    @Param('stationId') stationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.djBoothService.getQueue(
      stationId,
      limit ? parseInt(limit, 10) : 25,
    );
  }

  @Patch(':stationId/queue')
  replaceQueue(
    @Param('stationId') stationId: string,
    @Body() body: { stackIds: string[] },
  ) {
    return this.djBoothService.replaceQueue(stationId, body.stackIds ?? []);
  }

  @Post(':stationId/queue')
  addQueueEntries(
    @Param('stationId') stationId: string,
    @Body()
    body: {
      items: Array<{ stackId?: string; songId?: string; source?: 'songs' }>;
      position?: number;
      allowDuplicates?: boolean;
    },
  ) {
    return this.djBoothService.addQueueEntries(stationId, body);
  }

  @Delete(':stationId/queue')
  removeQueueEntry(
    @Param('stationId') stationId: string,
    @Query('position') position?: string,
    @Query('stackId') stackId?: string,
    @Query('songId') songId?: string,
  ) {
    return this.djBoothService.removeQueueEntry(stationId, {
      position: position ? parseInt(position, 10) : undefined,
      stackId,
      songId,
    });
  }

  @Post(':stationId/queue/skip')
  skipForward(@Param('stationId') stationId: string) {
    return this.djBoothService.skipForward(stationId);
  }

  @Post(':stationId/transport/pause')
  pauseTransport(@Param('stationId') stationId: string) {
    return this.djBoothService.pauseTransport(stationId);
  }

  @Post(':stationId/transport/play')
  playTransport(@Param('stationId') stationId: string) {
    return this.djBoothService.playTransport(stationId);
  }

  @Post(':stationId/transport/back')
  skipBack(@Param('stationId') stationId: string) {
    return this.djBoothService.skipBack(stationId);
  }

  @Post(':stationId/mic/session')
  async createMicSession(
    @Param('stationId') stationId: string,
    @Req() req: { user?: { uid?: string } },
  ) {
    const adminUserId = await this.getAdminDbId(req);
    return this.djBoothService.createMicSession(stationId, adminUserId);
  }

  @Delete(':stationId/mic/session')
  deleteMicSession(@Param('stationId') stationId: string) {
    return this.djBoothService.deleteMicSession(stationId);
  }

  @Post(':stationId/mic/on')
  micOn(@Param('stationId') stationId: string) {
    return this.djBoothService.micOn(stationId);
  }

  @Post(':stationId/mic/off')
  micOff(@Param('stationId') stationId: string) {
    return this.djBoothService.micOff(stationId);
  }

  @Patch(':stationId/mic/duck-volume')
  setDuckVolume(
    @Param('stationId') stationId: string,
    @Body() body: { duckVolume: number },
  ) {
    return this.djBoothService.setDuckVolume(stationId, body.duckVolume ?? 0.25);
  }

  @Post(':stationId/soundboard/:clipId/play')
  playSoundboardClip(
    @Param('stationId') stationId: string,
    @Param('clipId') clipId: string,
  ) {
    return this.djBoothService.playSoundboardClip(stationId, clipId);
  }
}
