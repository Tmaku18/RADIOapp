import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { ProServicesService } from './pro-services.service';
import { ProNetworkSubscriptionService } from '../pro-network-subscription/pro-network-subscription.service';
import {
  CreateProServiceListingDto,
  UpdateProServiceListingDto,
} from './dto/create-pro-service-listing.dto';

@Controller('pro-networx/services')
@UseGuards(FirebaseAuthGuard)
export class ProServicesController {
  constructor(
    private readonly services: ProServicesService,
    private readonly proSub: ProNetworkSubscriptionService,
  ) {}

  private async getUserContext(firebaseUid: string): Promise<{
    id: string;
    role: string;
  }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return { id: data.id as string, role: (data as any).role ?? 'listener' };
  }

  @Get()
  async list(
    @CurrentUser() user: FirebaseUser,
    @Query('serviceType') serviceType?: string,
    @Query('search') search?: string,
    @Query('minPriceCents') minPriceCentsStr?: string,
    @Query('maxPriceCents') maxPriceCentsStr?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const ctx = await this.getUserContext(user.uid);
    const access = await this.proSub.getAccess(ctx.id);
    const limit = limitStr ? parseInt(limitStr, 10) || 20 : undefined;
    const offset = offsetStr ? parseInt(offsetStr, 10) || 0 : undefined;
    const minPriceCents = minPriceCentsStr
      ? parseInt(minPriceCentsStr, 10)
      : undefined;
    const maxPriceCents = maxPriceCentsStr
      ? parseInt(maxPriceCentsStr, 10)
      : undefined;
    return this.services.list({
      viewerHasSubscription: access.hasAccess,
      serviceType,
      search,
      minPriceCents: Number.isFinite(minPriceCents)
        ? (minPriceCents as number)
        : undefined,
      maxPriceCents: Number.isFinite(maxPriceCents)
        ? (maxPriceCents as number)
        : undefined,
      limit,
      offset,
    });
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
  ) {
    const ctx = await this.getUserContext(user.uid);
    const access = await this.proSub.getAccess(ctx.id);
    return this.services.getOne(id, access.hasAccess);
  }
}

@Controller('pro-networx/users')
@UseGuards(FirebaseAuthGuard)
export class ProUserServicesController {
  constructor(
    private readonly services: ProServicesService,
    private readonly proSub: ProNetworkSubscriptionService,
  ) {}

  private async getUserContext(firebaseUid: string): Promise<{ id: string }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return { id: data.id as string };
  }

  /** List published services owned by a single user. */
  @Get(':userId/services')
  async listForUser(
    @CurrentUser() user: FirebaseUser,
    @Param('userId') userId: string,
  ) {
    const ctx = await this.getUserContext(user.uid);
    const access = await this.proSub.getAccess(ctx.id);
    const items = (await this.services.listForUser(userId, access.hasAccess))
      // Hide unpublished/paused listings from non-owners.
      .filter(
        (l) =>
          (l.status === 'active' && l.isPublished) || ctx.id === l.ownerUserId,
      );
    return { items };
  }
}

@Controller('pro-networx/me/services')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('artist', 'service_provider', 'admin')
export class ProMyServicesController {
  constructor(private readonly services: ProServicesService) {}

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return data.id as string;
  }

  @Get()
  async listMine(@CurrentUser() user: FirebaseUser) {
    const userId = await this.getUserId(user.uid);
    return { items: await this.services.listMy(userId) };
  }

  @Post()
  async create(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: CreateProServiceListingDto,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.services.create(userId, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Body() dto: UpdateProServiceListingDto,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.services.update(userId, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserId(user.uid);
    await this.services.remove(userId, id);
    return { ok: true };
  }
}

// Suppress unused imports warning when ForbiddenException only appears via
// the service throws above.
void ForbiddenException;
