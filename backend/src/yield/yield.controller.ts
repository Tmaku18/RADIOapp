import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { ProspectorYieldService } from '../radio/prospector-yield.service';

@Controller('yield')
export class YieldController {
  constructor(private readonly prospectorYieldService: ProspectorYieldService) {}

  @Post('redeem')
  async redeem(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { amountCents: number; type: 'virtual_visa' | 'merch' | 'boost_credits'; requestId?: string | null },
  ) {
    return this.prospectorYieldService.redeem(user.uid, body);
  }
}

