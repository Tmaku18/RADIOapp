import {
  Body,
  Controller,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { ModerationService } from './moderation.service';

@Controller('moderation')
@UseGuards(FirebaseAuthGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post('reports')
  async report(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { targetType?: string; targetId?: string; reason?: string },
  ) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .maybeSingle();
    if (!data?.id) throw new NotFoundException('User not found');
    return this.moderation.report(
      String(data.id),
      (body?.targetType ?? '').trim(),
      (body?.targetId ?? '').trim(),
      body?.reason ?? '',
    );
  }
}
