import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (error || !data) {
      throw new UnauthorizedException('User not found');
    }

    return data.id;
  }

  @Get()
  async getNotifications(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limit?: string,
  ) {
    const userId = await this.getUserId(user.uid);
    const notifications = await this.notificationService.getForUser(
      userId,
      limit ? parseInt(limit, 10) : 50,
    );

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        read: n.read,
        createdAt: n.created_at,
      })),
    };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: FirebaseUser) {
    try {
      if (!user?.uid) {
        return { count: 0 };
      }
      const userId = await this.getUserId(user.uid);
      const count = await this.notificationService.getUnreadCount(userId);
      return { count };
    } catch {
      return { count: 0 };
    }
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: FirebaseUser,
    @Param('id') notificationId: string,
  ) {
    const userId = await this.getUserId(user.uid);
    await this.notificationService.markAsRead(notificationId, userId);
    return { success: true };
  }

  @Post('mark-all-read')
  async markAllAsRead(@CurrentUser() user: FirebaseUser) {
    const userId = await this.getUserId(user.uid);
    return this.notificationService.markAllAsRead(userId);
  }

  /**
   * Soft delete a single notification.
   */
  @Delete(':id')
  async deleteNotification(
    @CurrentUser() user: FirebaseUser,
    @Param('id') notificationId: string,
  ) {
    const userId = await this.getUserId(user.uid);
    await this.notificationService.delete(notificationId, userId);
    return { success: true };
  }

  /**
   * Soft delete all notifications for the current user.
   */
  @Delete()
  async deleteAllNotifications(@CurrentUser() user: FirebaseUser) {
    const userId = await this.getUserId(user.uid);
    return this.notificationService.deleteAll(userId);
  }
}
