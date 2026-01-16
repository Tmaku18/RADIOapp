import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }
}
