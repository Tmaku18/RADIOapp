import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { GooglePlayBillingService } from './google-play-billing.service';
import { CreatorNetworkModule } from '../creator-network/creator-network.module';

@Module({
  imports: [CreatorNetworkModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, GooglePlayBillingService],
  exports: [StripeService],
})
export class PaymentsModule {}
