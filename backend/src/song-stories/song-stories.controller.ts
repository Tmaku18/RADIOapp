import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { UsersService } from '../users/users.service';
import { SongStoriesService } from './song-stories.service';

function storyVisibility(
  value: string | undefined,
): 'public' | 'private' | 'hidden' {
  if (value === 'private' || value === 'hidden') return value;
  return 'public';
}

@Controller('song-stories')
@UseGuards(FirebaseAuthGuard)
export class SongStoriesController {
  constructor(
    private readonly stories: SongStoriesService,
    private readonly users: UsersService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: FirebaseUser,
    @Query('songId') songId?: string,
  ) {
    const viewerId = await this.users.getDbUserIdByFirebaseUid(user.uid);
    const stories = await this.stories.listForSong((songId ?? '').trim(), viewerId);
    return { stories };
  }

  @Post()
  async create(
    @CurrentUser() user: FirebaseUser,
    @Body()
    body: {
      path?: string;
      songId?: string;
      visibility?: string;
      caption?: string;
      contentType?: string;
    },
  ) {
    const userId = await this.users.getDbUserIdByFirebaseUid(user.uid);
    const visibility = storyVisibility(body?.visibility);
    const story = await this.stories.create({
      userId,
      songId: (body?.songId ?? '').trim(),
      path: (body?.path ?? '').trim(),
      visibility,
      caption: body?.caption,
      contentType: body?.contentType,
    });
    return story;
  }

  @Patch(':id')
  async setVisibility(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Body() body: { visibility?: string },
  ) {
    const userId = await this.users.getDbUserIdByFirebaseUid(user.uid);
    const visibility = storyVisibility(body?.visibility);
    return this.stories.setVisibility(userId, id, visibility);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: FirebaseUser, @Param('id') id: string) {
    const userId = await this.users.getDbUserIdByFirebaseUid(user.uid);
    return this.stories.remove(userId, id);
  }
}
