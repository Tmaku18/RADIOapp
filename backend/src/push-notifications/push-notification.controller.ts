import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
} from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto/register-device.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('push-notifications')
export class PushNotificationController {
  constructor(private readonly pushNotificationService: PushNotificationService) {}

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (!data) {
      throw new Error('User not found');
    }

    return data.id;
  }

  /**
   * Register a device token for push notifications
   * POST /api/v1/push-notifications/register-device
   */
  @Post('register-device')
  async registerDevice(
    @CurrentUser() firebaseUser: FirebaseUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    const userId = await this.getUserId(firebaseUser.uid);
    return this.pushNotificationService.registerDeviceToken(
      userId,
      dto.fcmToken,
      dto.deviceType,
    );
  }

  /**
   * Unregister a device token
   * POST /api/v1/push-notifications/unregister-device
   */
  @Post('unregister-device')
  async unregisterDevice(
    @CurrentUser() firebaseUser: FirebaseUser,
    @Body() dto: UnregisterDeviceDto,
  ) {
    const userId = await this.getUserId(firebaseUser.uid);
    return this.pushNotificationService.unregisterDeviceToken(userId, dto.fcmToken);
  }

  /**
   * Get user's registered devices
   * GET /api/v1/push-notifications/devices
   */
  @Get('devices')
  async getDevices(@CurrentUser() firebaseUser: FirebaseUser) {
    const userId = await this.getUserId(firebaseUser.uid);
    const devices = await this.pushNotificationService.getUserDevices(userId);
    return { devices };
  }
}
