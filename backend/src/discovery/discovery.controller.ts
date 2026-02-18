import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('discovery')
@UseGuards(FirebaseAuthGuard)
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('people')
  async listPeople(
    @CurrentUser() user: FirebaseUser,
    @Query('serviceType') serviceType?: string,
    @Query('location') location?: string,
    @Query('search') search?: string,
    @Query('role') role?: 'artist' | 'service_provider' | 'all',
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('minRateCents') minRateCentsStr?: string,
    @Query('maxRateCents') maxRateCentsStr?: string,
    @Query('lat') latStr?: string,
    @Query('lng') lngStr?: string,
    @Query('radiusKm') radiusKmStr?: string,
  ) {
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 20, 50) : undefined;
    const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10)) : undefined;
    const minRateCents = minRateCentsStr != null ? parseInt(minRateCentsStr, 10) : undefined;
    const maxRateCents = maxRateCentsStr != null ? parseInt(maxRateCentsStr, 10) : undefined;
    const lat = latStr != null ? parseFloat(latStr) : undefined;
    const lng = lngStr != null ? parseFloat(lngStr) : undefined;
    const radiusKm = radiusKmStr != null ? parseFloat(radiusKmStr) : undefined;
    const radiusKmVal = typeof radiusKm === 'number' && Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : undefined;
    return this.discovery.listPeople({
      serviceType,
      location,
      search,
      role: role ?? 'all',
      limit,
      offset,
      minRateCents: Number.isFinite(minRateCents) ? minRateCents : undefined,
      maxRateCents: Number.isFinite(maxRateCents) ? maxRateCents : undefined,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      radiusKm: radiusKmVal,
    });
  }
}
