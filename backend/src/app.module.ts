import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    UsersModule,
    SongsModule,
    RadioModule,
    PaymentsModule,
    CreditsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
