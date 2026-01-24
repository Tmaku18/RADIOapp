import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { initializeFirebase } from './config/firebase.config';
import { initializeSupabase } from './config/supabase.config';
import { LoggerService } from './common/logger';
import { SentryService } from './common/sentry';
import { AllExceptionsFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for Stripe webhooks
    bufferLogs: true, // Buffer logs until custom logger is set
  });
  
  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);
  const sentry = app.get(SentryService);

  // Use custom logger for NestJS
  app.useLogger(logger);

  // Initialize Firebase Admin
  initializeFirebase(configService);

  // Initialize Supabase
  initializeSupabase(configService);

  // Enable global exception filter with logging and Sentry
  app.useGlobalFilters(new AllExceptionsFilter(logger, sentry));

  // Enable global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties sent
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable CORS
  const corsOrigin = configService.get<string>('CORS_ORIGIN') || '*';
  app.enableCors({
    origin: corsOrigin.split(','),
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  
  logger.log(
    `Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
}
bootstrap();
