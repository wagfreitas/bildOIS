import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Configuração global de validação
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Prefixo global da API
  app.setGlobalPrefix('api');

  const port = configService.get('PORT', 3000);
  const env = configService.get('NODE_ENV', 'development');
  
  await app.listen(port);

  logger.log(`BILD API Oracle Fusion Associa OIS iniciada`);
  logger.log(`Ambiente: ${env}`);
  logger.log(`Porta: ${port}`);
  logger.log(`Health Check disponível em: /api/health`);
}

bootstrap();
