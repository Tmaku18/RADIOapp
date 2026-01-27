import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
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

  @Put('me')
  async updateCurrentUser(
    @CurrentUser() user: FirebaseUser,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(user.uid, updateUserDto);
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
