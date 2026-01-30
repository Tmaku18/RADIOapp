import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
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
    // Simply return the user profile - don't auto-create
    // Profile creation should happen during signup with the correct role
    return this.usersService.getUserByFirebaseUid(user.uid);
  }

  @Put('me')
  async updateCurrentUser(
    @CurrentUser() user: FirebaseUser,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(user.uid, updateUserDto);
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }
}
