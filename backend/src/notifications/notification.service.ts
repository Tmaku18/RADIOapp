import { Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

export interface CreateNotificationDto {
  userId: string;
  type: string;
  title: string;
  message?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async create(dto: CreateNotificationDto) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        metadata: dto.metadata,
        read: false,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create notification: ${error.message}`);
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    this.logger.log(`Notification created for user ${dto.userId}: ${dto.type}`);
    return data;
  }

  async getForUser(userId: string, limit = 50) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    return data;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      throw new Error(`Failed to count notifications: ${error.message}`);
    }

    return count || 0;
  }

  async markAsRead(notificationId: string, userId: string) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId) // Security: only owner can mark as read
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }

    return data;
  }

  async markAllAsRead(userId: string) {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      throw new Error(`Failed to mark notifications as read: ${error.message}`);
    }

    return { success: true };
  }
}
