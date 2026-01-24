import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatAdminController } from './chat-admin.controller';
import { ChatAdminService } from './chat-admin.service';
import { EmojiController } from './emoji.controller';
import { EmojiService } from './emoji.service';

@Module({
  controllers: [ChatController, ChatAdminController, EmojiController],
  providers: [ChatService, ChatAdminService, EmojiService],
  exports: [ChatService, ChatAdminService, EmojiService],
})
export class ChatModule {}
