import { Module, Global } from '@nestjs/common';
import { CloudflareStreamService } from './cloudflare-stream.service';

@Global()
@Module({
  providers: [CloudflareStreamService],
  exports: [CloudflareStreamService],
})
export class StreamingModule {}
