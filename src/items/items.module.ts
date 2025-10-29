import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemAssociationService } from './services/item-association.service';
import { OracleModule } from '../oracle/oracle.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [OracleModule, AiModule],
  controllers: [ItemsController],
  providers: [ItemAssociationService],
  exports: [ItemAssociationService],
})
export class ItemsModule {}
