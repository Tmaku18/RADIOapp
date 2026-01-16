import { Controller, Get, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { CurrentUser } from './decorators/user.decorator';
import type { FirebaseUser } from './decorators/user.decorator';

@Controller('auth')
export class AuthController {
  @Get('verify')
  @UseGuards(FirebaseAuthGuard)
  verify(@CurrentUser() user: FirebaseUser) {
    return {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
    };
  }
}
