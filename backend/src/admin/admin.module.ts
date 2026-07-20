import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { EmailModule } from '../email/email.module';
import { RadioModule } from '../radio/radio.module';
import { AppVersionModule } from '../app-version/app-version.module';

@Module({
  imports: [EmailModule, RadioModule, AppVersionModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
