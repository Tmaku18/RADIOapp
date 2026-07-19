import { Controller, Get, Query } from '@nestjs/common';
import { FeedService } from './feed.service';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('news-promotions')
  async getNewsPromotions(@Query('limit') limitStr?: string) {
    const limit = Math.min(parseInt(limitStr || '10', 10) || 10, 50);
    return this.feedService.getNewsPromotions(limit);
  }
}
