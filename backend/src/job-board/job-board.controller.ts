import {
  Controller,
  Get,
  Param,
  Post,
  Delete,
  Query,
  Body,
  UseGuards,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JobBoardService } from './job-board.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { getSupabaseClient } from '../config/supabase.config';
import { ProNetworkSubscriptionService } from '../pro-network-subscription/pro-network-subscription.service';
import { PRO_NETWORK_PAYWALL_PAYLOAD } from '../pro-network-subscription/pro-network-subscription.constants';

@Controller('job-board')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('artist', 'admin')
export class JobBoardController {
  constructor(
    private readonly jobBoard: JobBoardService,
    private readonly proNetworkSubscription: ProNetworkSubscriptionService,
  ) {}

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

  private async getUserIdAndRole(
    firebaseUid: string,
  ): Promise<{ id: string; role: string | null }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return { id: data.id, role: (data.role as string | null) ?? null };
  }

  @Get('requests')
  @Roles('listener')
  async listRequests(
    @CurrentUser() user: FirebaseUser,
    @Query('serviceType') serviceType?: string,
    @Query('status') status?: 'open' | 'closed' | 'all',
    @Query('mine') mineStr?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const limit = limitStr
      ? Math.min(parseInt(limitStr, 10) || 20, 50)
      : undefined;
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

  @Post('requests')
  @Roles('listener')
  async createRequest(
    @CurrentUser() user: FirebaseUser,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      serviceType?: string | null;
    },
  ) {
    const userId = await this.getUserId(user.uid);
    return this.jobBoard.createRequest({
      artistId: userId,
      title: body?.title ?? '',
      description: body?.description ?? null,
      serviceType: body?.serviceType ?? null,
    });
  }

  @Get('requests/:requestId')
  @Roles('listener')
  async getRequest(@Param('requestId') requestId: string) {
    const req = await this.jobBoard.getRequest(requestId);
    if (!req) throw new NotFoundException('Request not found');
    return req;
  }

  @Delete('requests/:requestId')
  @Roles('listener')
  async deleteRequest(
    @CurrentUser() user: FirebaseUser,
    @Param('requestId') requestId: string,
  ) {
    const { id, role } = await this.getUserIdAndRole(user.uid);
    return this.jobBoard.deleteRequest(requestId, id, role === 'admin');
  }

  @Post('requests/:requestId/applications')
  @Roles('listener')
  async apply(
    @CurrentUser() user: FirebaseUser,
    @Param('requestId') requestId: string,
    @Body() body: { message?: string | null },
  ) {
    const userId = await this.getUserId(user.uid);
    // Browsing requests is open to everyone, but reaching out to the poster
    // (applying / messaging) requires a Pro-Networx subscription.
    const access = await this.proNetworkSubscription.getAccess(userId);
    if (!access.hasAccess) {
      throw new ForbiddenException(PRO_NETWORK_PAYWALL_PAYLOAD);
    }
    return this.jobBoard.apply(requestId, userId, body?.message ?? null);
  }

  @Get('requests/:requestId/applications')
  @Roles('listener')
  async listApplications(
    @CurrentUser() user: FirebaseUser,
    @Param('requestId') requestId: string,
  ) {
    // Open to any signed-in member; the service enforces that only the request
    // owner can actually view the applications.
    const userId = await this.getUserId(user.uid);
    return this.jobBoard.listApplicationsForRequest(requestId, userId);
  }
}
