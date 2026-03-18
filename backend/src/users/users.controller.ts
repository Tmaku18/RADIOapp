import {
  Delete,
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateArtistLikeNotificationSettingsDto } from './dto/update-artist-like-notification-settings.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Create a new user in Supabase after Firebase authentication.
   * Called by frontend after successful Firebase sign-up (email or Google).
   * No role guard: new users have no Supabase row yet; role is set from request body (listener | artist | service_provider).
   */
  @Post()
  async createUser(
    @CurrentUser() user: FirebaseUser,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.usersService.createUser(user.uid, createUserDto);
  }

  @Get('me')
  async getCurrentUser(@CurrentUser() user: FirebaseUser) {
    return this.usersService.getUserByFirebaseUid(user.uid);
  }

  /**
   * Check if the current user's email is in the admin allowlist.
   * Used by frontend to skip role selection for first-time admin logins.
   */
  @Get('me/check-admin')
  async checkAdmin(@CurrentUser() user: FirebaseUser) {
    return { isAdmin: this.usersService.isAdminEmail(user.email) };
  }

  @Put('me')
  async updateCurrentUser(
    @CurrentUser() user: FirebaseUser,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    try {
      return await this.usersService.updateUser(user.uid, updateUserDto);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update profile';
      throw new BadRequestException(message);
    }
  }

  @Get('me/artist-like-notifications')
  async getArtistLikeNotificationSettings(@CurrentUser() user: FirebaseUser) {
    return this.usersService.getArtistLikeNotificationSettings(user.uid);
  }

  @Put('me/artist-like-notifications')
  async updateArtistLikeNotificationSettings(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: UpdateArtistLikeNotificationSettingsDto,
  ) {
    return this.usersService.updateArtistLikeNotificationSettings(
      user.uid,
      dto,
    );
  }

  /**
   * Upload and set profile picture. Accepts JPEG, PNG, WebP up to 15MB.
   */
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: FirebaseUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send a file in the "file" field.',
      );
    }
    return this.usersService.updateAvatar(user.uid, file);
  }

  /**
   * Upgrade current listener account to artist.
   * Initializes credits record for the new artist.
   */
  @Post('upgrade-to-artist')
  async upgradeToArtist(@CurrentUser() user: FirebaseUser) {
    return this.usersService.upgradeToArtist(user.uid);
  }

  /**
   * Upgrade to Catalyst (service provider) for ProNetworx. Creates service_providers row.
   */
  @Post('upgrade-to-catalyst')
  async upgradeToCatalyst(@CurrentUser() user: FirebaseUser) {
    return this.usersService.upgradeToCatalyst(user.uid);
  }

  @Public()
  @Get(':id/artist-profile')
  async getArtistProfile(@Param('id') id: string) {
    return this.usersService.getArtistProfile(id);
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Post(':id/follow')
  async followUser(@CurrentUser() user: FirebaseUser, @Param('id') id: string) {
    return this.usersService.followUser(user.uid, id);
  }

  @Delete(':id/follow')
  async unfollowUser(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
  ) {
    return this.usersService.unfollowUser(user.uid, id);
  }

  @Get(':id/follow')
  async isFollowingUser(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
  ) {
    return this.usersService.isFollowingUser(user.uid, id);
  }

  @Public()
  @Get(':id/follow-counts')
  async getFollowCounts(@Param('id') id: string) {
    return this.usersService.getFollowCounts(id);
  }

  @Public()
  @Get(':id/followers')
  async getFollowers(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? parseInt(offset, 10) : undefined;
    return this.usersService.getFollowers(
      id,
      Number.isFinite(parsedLimit as number) ? parsedLimit : undefined,
      Number.isFinite(parsedOffset as number) ? parsedOffset : undefined,
    );
  }

  @Public()
  @Get(':id/following')
  async getFollowing(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? parseInt(offset, 10) : undefined;
    return this.usersService.getFollowing(
      id,
      Number.isFinite(parsedLimit as number) ? parsedLimit : undefined,
      Number.isFinite(parsedOffset as number) ? parsedOffset : undefined,
    );
  }
}
