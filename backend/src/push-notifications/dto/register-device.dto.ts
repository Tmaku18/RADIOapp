import { IsString, IsIn } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  fcmToken: string;

  @IsString()
  @IsIn(['ios', 'android', 'web'])
  deviceType: 'ios' | 'android' | 'web';
}

export class UnregisterDeviceDto {
  @IsString()
  fcmToken: string;
}
