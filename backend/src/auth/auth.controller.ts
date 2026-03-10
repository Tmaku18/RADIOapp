import { Controller, Get, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { CurrentUser } from './decorators/user.decorator';
import type { FirebaseUser } from './decorators/user.decorator';
import { Public } from './decorators/public.decorator';
import { getFirebaseAuth } from '../config/firebase.config';
import {
  setCrossDomainToken,
  getAndDeleteCrossDomainToken,
  isAllowedTargetHost,
} from './cross-domain-token.store';
import {
  CreateCrossDomainTokenDto,
  ExchangeCrossDomainTokenDto,
} from './dto/cross-domain-token.dto';
import { randomBytes } from 'crypto';

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

  /**
   * Create a one-time token to hand off login to another allowed domain.
   * Client sends idToken (from Firebase) and targetHost (e.g. https://www.networxradio.com).
   */
  @Post('cross-domain-token')
  @Public()
  async createCrossDomainToken(@Body() dto: CreateCrossDomainTokenDto) {
    if (!isAllowedTargetHost(dto.targetHost)) {
      throw new BadRequestException('Target host is not allowed');
    }
    const auth = getFirebaseAuth();
    await auth.verifyIdToken(dto.idToken);
    const token = randomBytes(32).toString('hex');
    setCrossDomainToken(token, dto.idToken, dto.targetHost.replace(/\/$/, ''));
    return {
      token,
      redirectUrl: `${dto.targetHost.replace(/\/$/, '')}/cross-domain-login?token=${token}`,
    };
  }

  /**
   * Exchange a one-time token for session cookie info.
   * Called by the target domain's frontend; currentHost must match the token's targetHost.
   */
  @Post('cross-domain-exchange')
  @Public()
  async exchangeCrossDomainToken(@Body() dto: ExchangeCrossDomainTokenDto) {
    const entry = getAndDeleteCrossDomainToken(dto.token);
    if (!entry) {
      throw new BadRequestException('Invalid or expired token');
    }
    const currentHost = dto.currentHost.replace(/\/$/, '').toLowerCase();
    const targetHost = entry.targetHost.toLowerCase();
    if (currentHost !== targetHost) {
      throw new BadRequestException('Current host does not match token target');
    }
    const auth = getFirebaseAuth();
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await auth.createSessionCookie(entry.idToken, { expiresIn });
    return {
      sessionCookie,
      maxAge: Math.floor(expiresIn / 1000),
    };
  }
}
