import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { GooglePlayBillingService } from './google-play-billing.service';
import { CreatorNetworkModule } from '../creator-network/creator-network.module';
import { RefineryModule } from '../refinery/refinery.module';

@Module({
  imports: [CreatorNetworkModule, forwardRef(() => RefineryModule)],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, GooglePlayBillingService],
  exports: [StripeService],
})
export class PaymentsModule {}
