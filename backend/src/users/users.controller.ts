import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Create a new user in Supabase after Firebase authentication.
   * Called by frontend after successful Firebase sign-up.
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
    return this.usersService.updateUser(user.uid, updateUserDto);
  }

  /**
   * Upload and set profile picture. Accepts JPEG, PNG, WebP up to 2MB.
   */
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: FirebaseUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Send a file in the "file" field.');
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

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }
}
