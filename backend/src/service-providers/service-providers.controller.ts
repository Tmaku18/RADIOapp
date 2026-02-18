import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { UploadsService } from '../uploads/uploads.service';
import { ServiceProvidersService } from './service-providers.service';
import { UpdateServiceProviderProfileDto } from './dto/update-service-provider-profile.dto';
import { CreateServiceListingDto } from './dto/create-service-listing.dto';
import { UpdateServiceListingDto } from './dto/update-service-listing.dto';
import { AddPortfolioItemDto } from './dto/add-portfolio-item.dto';
import { GetPortfolioUploadUrlDto } from './dto/get-portfolio-upload-url.dto';

@Controller('service-providers')
@UseGuards(FirebaseAuthGuard)
export class ServiceProvidersController {
  constructor(
    private readonly service: ServiceProvidersService,
    private readonly uploads: UploadsService,
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

  /**
   * Public provider profile (any authenticated user can view).
   */
  @Get(':userId')
  async getProviderByUserId(@Param('userId') userId: string) {
    return this.service.getPublicProviderProfile(userId);
  }

  /**
   * \"Me\" provider profile editor (service providers only).
   */
  @Get('me/profile')
  @UseGuards(RolesGuard)
  @Roles('service_provider', 'admin')
  async getMyProfile(@CurrentUser() user: FirebaseUser) {
    const userId = await this.getUserId(user.uid);
    return this.service.getMyProviderProfile(userId);
  }

  @Put('me/profile')
  @UseGuards(RolesGuard)
  @Roles('service_provider', 'admin')
  async updateMyProfile(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: UpdateServiceProviderProfileDto,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.service.upsertMyProviderProfile(userId, dto);
  }

  @Post('me/listings')
  @UseGuards(RolesGuard)
  @Roles('service_provider', 'admin')
  async createListing(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: CreateServiceListingDto,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.service.createListing(userId, dto);
  }

  @Patch('me/listings/:listingId')
  @UseGuards(RolesGuard)
  @Roles('service_provider', 'admin')
  async updateListing(
    @CurrentUser() user: FirebaseUser,
    @Param('listingId') listingId: string,
    @Body() dto: UpdateServiceListingDto,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.service.updateListing(userId, listingId, dto);
  }

  @Delete('me/listings/:listingId')
  @UseGuards(RolesGuard)
  @Roles('service_provider', 'admin')
  async deleteListing(
    @CurrentUser() user: FirebaseUser,
    @Param('listingId') listingId: string,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.service.deleteListing(userId, listingId);
  }

  @Post('me/portfolio')
  @UseGuards(RolesGuard)
  @Roles('service_provider', 'admin')
  async addPortfolioItem(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: AddPortfolioItemDto,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.service.addPortfolioItem(userId, dto);
  }

  @Delete('me/portfolio/:portfolioItemId')
  @UseGuards(RolesGuard)
  @Roles('service_provider', 'admin')
  async deletePortfolioItem(
    @CurrentUser() user: FirebaseUser,
    @Param('portfolioItemId') portfolioItemId: string,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.service.deletePortfolioItem(userId, portfolioItemId);
  }

  /**
   * Signed upload URL for portfolio media.
   *
   * IMPORTANT: Requires a Supabase Storage bucket named `portfolio`.
   * The bucket should be configured for public reads (or you must add signed download support later).
   */
  @Post('portfolio/upload-url')
  @UseGuards(RolesGuard)
  @Roles('service_provider', 'admin')
  async getPortfolioUploadUrl(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: GetPortfolioUploadUrlDto,
  ) {
    const userId = await this.getUserId(user.uid);
    const signed = await this.uploads.getSignedUploadUrl(
      userId,
      'portfolio',
      dto.filename,
      dto.contentType,
    );

    const supabase = getSupabaseClient();
    const { data } = supabase.storage.from('portfolio').getPublicUrl(signed.path);

    return {
      ...signed,
      publicUrl: data.publicUrl,
    };
  }
}

