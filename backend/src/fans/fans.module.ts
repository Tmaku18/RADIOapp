import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { FansController } from './fans.controller';
import { FansService } from './fans.service';

@Module({
  imports: [EmailModule],
  controllers: [FansController],
  providers: [FansService],
})
export class FansModule {}
