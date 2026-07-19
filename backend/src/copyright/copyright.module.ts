import { Module } from '@nestjs/common';
import { CopyrightService } from './copyright.service';
import { AcrCloudProvider } from './acrcloud.provider';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule],
  providers: [CopyrightService, AcrCloudProvider],
  exports: [CopyrightService],
})
export class CopyrightModule {}
