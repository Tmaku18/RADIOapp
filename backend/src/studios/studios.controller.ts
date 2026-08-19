import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { StudiosService } from './studios.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateStudioDto, UpdateStudioDto } from './dto/upsert-studio.dto';

@Controller('studios')
@UseGuards(FirebaseAuthGuard)
export class StudiosController {
  constructor(
    private readonly studios: StudiosService,
    private readonly uploads: UploadsService,
  ) {}

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return data.id as string;
  }

  @Get()
  async list(
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('lat') latStr?: string,
    @Query('lng') lngStr?: string,
    @Query('radiusKm') radiusKmStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const lat = latStr != null ? parseFloat(latStr) : undefined;
    const lng = lngStr != null ? parseFloat(lngStr) : undefined;
    const radiusKm = radiusKmStr != null ? parseFloat(radiusKmStr) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) || undefined : undefined;
    return this.studios.list({
      search,
      city,
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

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles('artist', 'service_provider', 'admin')
  async listMine(@CurrentUser() user: FirebaseUser) {
    const userId = await this.getUserId(user.uid);
    return { items: await this.studios.listMine(userId) };
  }

  @Get('people-search')
  @UseGuards(RolesGuard)
  @Roles('artist', 'service_provider', 'admin')
  async searchPeople(@Query('q') q?: string) {
    return { items: await this.studios.searchBookablePeople(q ?? '') };
  }

  /** JPEG, PNG, or WebP up to 15MB — same path as profile / cover photos. */
  @Post('photos')
  @UseGuards(RolesGuard)
  @Roles('artist', 'service_provider', 'admin')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadPhoto(
    @CurrentUser() user: FirebaseUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send a file in the "file" field.',
      );
    }
    const userId = await this.getUserId(user.uid);
    const url = await this.uploads.uploadHeroImage(file, userId);
    return { url };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.studios.getOne(id, userId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('artist', 'service_provider', 'admin')
  async create(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: CreateStudioDto,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.studios.create(userId, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('artist', 'service_provider', 'admin')
  async update(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudioDto,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.studios.update(userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('artist', 'service_provider', 'admin')
  async remove(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserId(user.uid);
    await this.studios.remove(userId, id);
    return { ok: true };
  }
}
