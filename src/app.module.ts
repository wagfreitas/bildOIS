import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ItemsModule } from './items/items.module';
import { HealthModule } from './health/health.module';
import { OracleModule } from './oracle/oracle.module';
import { LoggerModule } from './logger/logger.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    LoggerModule,
    OracleModule,
    ItemsModule,
    HealthModule,
  ],
})
export class AppModule {}
