import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { GooglePlayBillingService } from './google-play-billing.service';
import { AppStoreBillingService } from './app-store-billing.service';
import { CreatorNetworkModule } from '../creator-network/creator-network.module';
import { ProNetworkSubscriptionModule } from '../pro-network-subscription/pro-network-subscription.module';
import { ProRadioSubscriptionModule } from '../pro-radio-subscription/pro-radio-subscription.module';
import { RefineryModule } from '../refinery/refinery.module';

@Module({
  imports: [
    CreatorNetworkModule,
    ProNetworkSubscriptionModule,
    ProRadioSubscriptionModule,
    forwardRef(() => RefineryModule),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    StripeService,
    GooglePlayBillingService,
    AppStoreBillingService,
  ],
  exports: [StripeService, PaymentsService],
})
export class PaymentsModule {}
