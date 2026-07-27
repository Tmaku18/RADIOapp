import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from '../../src/auth/auth.controller';
import {
  TestFirebaseAuthGuard,
  TestRolesGuard,
} from './test-auth.guards';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: TestFirebaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TestRolesGuard,
    },
  ],
})
export class TestAuthModule {}
