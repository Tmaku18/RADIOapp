import { Controller, Get, Put, Query, Body, UseGuards, Param } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { ProNetworxService } from './pro-networx.service';
import { UpdateProProfileDto } from './dto/update-pro-profile.dto';
import { ListProDirectoryDto } from './dto/list-pro-directory.dto';

@Controller('pro-networx')
@UseGuards(FirebaseAuthGuard)
export class ProNetworxController {
  constructor(private readonly pro: ProNetworxService) {}

  @Get('me/profile')
  async getMe(@CurrentUser() user: FirebaseUser) {
    return this.pro.getMyProfile(user.uid);
  }

  @Put('me/profile')
  async upsertMe(@CurrentUser() user: FirebaseUser, @Body() dto: UpdateProProfileDto) {
    return this.pro.upsertMyProfile(user.uid, dto);
  }

  @Get('directory')
  async list(@Query() q: ListProDirectoryDto) {
    return this.pro.listDirectory({
      skill: q.skill,
      availableForWork: q.availableForWork != null ? q.availableForWork === 'true' : undefined,
      search: q.search,
      location: q.location,
      sort: q.sort,
    });
  }

  @Get('profiles/:userId')
  async getProfile(@Param('userId') userId: string) {
    return this.pro.getProfileByUserId(userId);
  }
}

