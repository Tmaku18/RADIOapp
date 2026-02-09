import { Controller, Get, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CreatorNetworkService } from './creator-network.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('creator-network')
@UseGuards(FirebaseAuthGuard)
export class CreatorNetworkController {
  constructor(private readonly creatorNetwork: CreatorNetworkService) {}

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('users').select('id').eq('firebase_uid', firebaseUid).single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return data.id;
  }

  @Get('access')
  async hasAccess(@CurrentUser() user: FirebaseUser): Promise<{ hasAccess: boolean }> {
    const userId = await this.getUserId(user.uid);
    const hasAccess = await this.creatorNetwork.hasCreatorNetworkAccess(userId);
    return { hasAccess };
  }
}
