import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { ProspectorYieldService } from './prospector-yield.service';

@Controller('prospector')
export class ProspectorController {
  constructor(private readonly prospectorYieldService: ProspectorYieldService) {}

  @Get('yield')
  async getYield(@CurrentUser() user: FirebaseUser) {
    return this.prospectorYieldService.getYield(user.uid);
  }

  @Post('check-in')
  async checkIn(@CurrentUser() user: FirebaseUser, @Body() body: { sessionId?: string | null }) {
    return this.prospectorYieldService.recordCheckIn(user.uid, body?.sessionId ?? null);
  }

  @Post('refinement')
  async refinement(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { songId: string; playId?: string | null; score: number }
  ) {
    return this.prospectorYieldService.submitRefinement(user.uid, body);
  }

  @Post('survey')
  async survey(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { songId: string; playId?: string | null; responses: Record<string, unknown> }
  ) {
    return this.prospectorYieldService.submitSurvey(user.uid, body);
  }

  @Post('redeem')
  async redeem(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { amountCents: number; type: 'virtual_visa' | 'merch' | 'boost_credits'; requestId?: string | null }
  ) {
    return this.prospectorYieldService.redeem(user.uid, body);
  }
}

