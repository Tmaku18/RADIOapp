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
      .is('deleted_at', null) // Exclude soft-deleted notifications
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    return data;
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const supabase = getSupabaseClient();

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false)
        .is('deleted_at', null); // Exclude soft-deleted

      if (error) {
        this.logger.warn(`Failed to count notifications for user ${userId}: ${error.message}`);
        return 0;
      }

      return count ?? 0;
    } catch (err) {
      this.logger.warn(`getUnreadCount failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    }
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
      .eq('read', false)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to mark notifications as read: ${error.message}`);
    }

    return { success: true };
  }

  /**
   * Soft delete a single notification.
   * Sets deleted_at timestamp instead of hard delete for audit trail.
   */
  async delete(notificationId: string, userId: string) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId) // Security: only owner can delete
      .is('deleted_at', null) // Only delete if not already deleted
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to delete notification: ${error.message}`);
      throw new Error(`Failed to delete notification: ${error.message}`);
    }

    this.logger.log(`Notification ${notificationId} soft-deleted`);
    return data;
  }

  /**
   * Soft delete all notifications for a user.
   */
  async deleteAll(userId: string) {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) {
      this.logger.error(`Failed to delete all notifications: ${error.message}`);
      throw new Error(`Failed to delete all notifications: ${error.message}`);
    }

    this.logger.log(`All notifications soft-deleted for user ${userId}`);
    return { success: true };
  }
}
