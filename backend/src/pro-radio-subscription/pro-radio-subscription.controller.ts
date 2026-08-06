import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import {
  ProRadioSubscriptionService,
  ProRadioAccess,
} from './pro-radio-subscription.service';
import {
  PRO_RADIO_INTRO_CENTS,
  PRO_RADIO_REGULAR_CENTS,
} from './pro-radio-subscription.constants';

@Controller('pro-radio-subscription')
@UseGuards(FirebaseAuthGuard)
export class ProRadioSubscriptionController {
  constructor(private readonly sub: ProRadioSubscriptionService) {}

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return data.id;
  }

  @Get('access')
  async access(@CurrentUser() user: FirebaseUser): Promise<
    ProRadioAccess & {
      pricing: { regularCents: number; introCents: number };
    }
  > {
    const userId = await this.getUserId(user.uid);
    const access = await this.sub.getAccess(userId);
    return {
      ...access,
      pricing: {
        regularCents: PRO_RADIO_REGULAR_CENTS,
        introCents: PRO_RADIO_INTRO_CENTS,
      },
    };
  }
}
