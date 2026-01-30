import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private async getUserId(firebaseUid: string): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();

    const row = data as { id: string } | null;
    return row?.id ?? null;
  }

  @Get()
  async getNotifications(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limit?: string,
  ) {
    const userId = await this.getUserId(user.uid);
    
    // Return empty array if user profile doesn't exist yet
    if (!userId) {
      return { notifications: [] };
    }
    
    const notifications = await this.notificationService.getForUser(
      userId,
      limit ? parseInt(limit, 10) : 50,
    );

    interface NotificationRow {
      id: string;
      type: string;
      title: string;
      message: string | null;
      metadata: unknown;
      read: boolean;
      created_at: string;
    }
    return {
      notifications: (notifications as NotificationRow[]).map((n) => ({
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
    const userId = await this.getUserId(user.uid);
    
    // Return 0 if user profile doesn't exist yet
    if (!userId) {
      return { count: 0 };
    }
    
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: FirebaseUser,
    @Param('id') notificationId: string,
  ) {
    const userId = await this.getUserId(user.uid);
    
    if (!userId) {
      throw new NotFoundException('User profile not found');
    }
    
    await this.notificationService.markAsRead(notificationId, userId);
    return { success: true };
  }

  @Post('mark-all-read')
  async markAllAsRead(@CurrentUser() user: FirebaseUser) {
    const userId = await this.getUserId(user.uid);
    
    if (!userId) {
      return { success: true }; // Nothing to mark as read
    }
    
    return this.notificationService.markAllAsRead(userId);
  }
}
