import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ItemsModule } from '../items/items.module';
import { OracleModule } from '../oracle/oracle.module';

@Module({
  imports: [ItemsModule, OracleModule],
  controllers: [HealthController],
})
export class HealthModule {}
