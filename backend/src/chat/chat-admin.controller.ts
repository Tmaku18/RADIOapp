import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ChatAdminService } from './chat-admin.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('admin/chat')
@UseGuards(RolesGuard)
@Roles('admin')
export class ChatAdminController {
  constructor(private readonly chatAdminService: ChatAdminService) {}

  /**
   * Kill Switch - Toggle chat globally
   * POST /api/v1/admin/chat/toggle
   */
  @Post('toggle')
  async toggleChat(@Body() body: { enabled: boolean; reason?: string }) {
    return this.chatAdminService.toggleChat(body.enabled, body.reason);
  }

  /**
   * Shadow ban a user
   * POST /api/v1/admin/chat/shadow-ban/:userId
   */
  @Post('shadow-ban/:userId')
  async shadowBanUser(
    @Param('userId') userId: string,
    @Body() body: { durationHours?: number },
  ) {
    return this.chatAdminService.shadowBanUser(userId, body.durationHours);
  }

  /**
   * Remove shadow ban from a user
   * POST /api/v1/admin/chat/unban/:userId
   */
  @Post('unban/:userId')
  async unbanUser(@Param('userId') userId: string) {
    return this.chatAdminService.unbanUser(userId);
  }

  /**
   * Get list of shadow banned users
   * GET /api/v1/admin/chat/shadow-banned
   */
  @Get('shadow-banned')
  async getShadowBannedUsers() {
    return this.chatAdminService.getShadowBannedUsers();
  }

  /**
   * Delete a specific message
   * DELETE /api/v1/admin/chat/messages/:messageId
   */
  @Delete('messages/:messageId')
  async deleteMessage(@Param('messageId') messageId: string) {
    return this.chatAdminService.deleteMessage(messageId);
  }
}
