import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SongsModule } from './songs/songs.module';
import { RadioModule } from './radio/radio.module';
import { PaymentsModule } from './payments/payments.module';
import { CreditsModule } from './credits/credits.module';
import { AdminModule } from './admin/admin.module';
import { NotificationModule } from './notifications/notification.module';
import { TasksModule } from './tasks/tasks.module';
import { EmailModule } from './email/email.module';
import { ChatModule } from './chat/chat.module';
import { PushNotificationModule } from './push-notifications/push-notification.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { FeedModule } from './feed/feed.module';
import { SpotlightModule } from './spotlight/spotlight.module';
import { CompetitionModule } from './competition/competition.module';
import { LiveServicesModule } from './live-services/live-services.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { CreatorNetworkModule } from './creator-network/creator-network.module';
import { ServiceMessagesModule } from './service-messages/service-messages.module';
import { JobBoardModule } from './job-board/job-board.module';
import { BrowseModule } from './browse/browse.module';
import { ServiceProvidersModule } from './service-providers/service-providers.module';
import { VenueAdsModule } from './venue-ads/venue-ads.module';
import { LoggerModule } from './common/logger';
import { SentryModule } from './common/sentry';
import { RequestIdMiddleware } from './common/middleware';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    SentryModule,
    AuthModule,
    UsersModule,
    SongsModule,
    RadioModule,
    PaymentsModule,
    CreditsModule,
    AdminModule,
    NotificationModule,
    TasksModule,
    EmailModule,
    ChatModule,
    PushNotificationModule,
    AnalyticsModule,
    SuggestionsModule,
    LeaderboardModule,
    FeedModule,
    SpotlightModule,
    CompetitionModule,
    LiveServicesModule,
    DiscoveryModule,
    CreatorNetworkModule,
    ServiceMessagesModule,
    JobBoardModule,
    BrowseModule,
    ServiceProvidersModule,
    VenueAdsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request ID middleware to all routes
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
