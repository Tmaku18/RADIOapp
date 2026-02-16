import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  UnauthorizedException,
  InternalServerErrorException,
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
    if (!user?.uid) {
      throw new UnauthorizedException('Not authenticated');
    }
    try {
      let userId: string;
      try {
        userId = await this.getUserId(user.uid);
      } catch {
        // Valid Firebase token but no backend profile yet (e.g. signup incomplete) — return empty so page loads
        return { notifications: [] };
      }
      const notifications = await this.notificationService.getForUser(
        userId,
        limit ? parseInt(limit, 10) : 50,
      );
      const list = Array.isArray(notifications) ? notifications : [];
      return {
        notifications: list.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          metadata: n.metadata,
          read: n.read,
          createdAt: n.created_at,
        })),
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new InternalServerErrorException('Failed to load notifications. Please try again.');
    }
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: FirebaseUser) {
    try {
      if (!user?.uid) {
        return { count: 0 };
      }
      let userId: string;
      try {
        userId = await this.getUserId(user.uid);
      } catch {
        return { count: 0 };
      }
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
