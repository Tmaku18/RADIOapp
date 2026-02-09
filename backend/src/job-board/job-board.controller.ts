import { Controller, Get, Param, Post, Query, Body, UseGuards, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JobBoardService } from './job-board.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('job-board')
@UseGuards(FirebaseAuthGuard)
export class JobBoardController {
  constructor(private readonly jobBoard: JobBoardService) {}

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('users').select('id').eq('firebase_uid', firebaseUid).single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return data.id;
  }

  @Get('requests')
  async listRequests(
    @CurrentUser() user: FirebaseUser,
    @Query('serviceType') serviceType?: string,
    @Query('status') status?: 'open' | 'closed' | 'all',
    @Query('mine') mineStr?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 20, 50) : undefined;
    const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10)) : undefined;
    const mine = mineStr === 'true' || mineStr === '1';
    let artistId: string | undefined;
    if (mine) {
      artistId = await this.getUserId(user.uid);
    }
    return this.jobBoard.listRequests({
      serviceType,
      status: status ?? 'open',
      mine,
      artistId,
      limit,
      offset,
    });
  }

  @Get('requests/:requestId')
  async getRequest(@Param('requestId') requestId: string) {
    const req = await this.jobBoard.getRequest(requestId);
    if (!req) throw new NotFoundException('Request not found');
    return req;
  }

  @Post('requests/:requestId/applications')
  async apply(
    @CurrentUser() user: FirebaseUser,
    @Param('requestId') requestId: string,
    @Body() body: { message?: string | null },
  ) {
    const userId = await this.getUserId(user.uid);
    return this.jobBoard.apply(requestId, userId, body?.message ?? null);
  }

  @Get('requests/:requestId/applications')
  async listApplications(@CurrentUser() user: FirebaseUser, @Param('requestId') requestId: string) {
    const userId = await this.getUserId(user.uid);
    return this.jobBoard.listApplicationsForRequest(requestId, userId);
  }
}
