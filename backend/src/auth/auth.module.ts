import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { PhoneMfaGuard } from './guards/phone-mfa.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthController } from './auth.controller';
import { PhoneMfaService } from './phone-mfa.service';
import { SmsService } from './sms.service';

@Module({
  controllers: [AuthController],
  providers: [
    PhoneMfaService,
    SmsService,
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PhoneMfaGuard,
    },
  ],
})
export class AuthModule {}
