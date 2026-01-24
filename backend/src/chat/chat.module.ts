import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatAdminController } from './chat-admin.controller';
import { ChatAdminService } from './chat-admin.service';

@Module({
  controllers: [ChatController, ChatAdminController],
  providers: [ChatService, ChatAdminService],
  exports: [ChatService, ChatAdminService],
})
export class ChatModule {}
