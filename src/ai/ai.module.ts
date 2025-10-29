import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SemanticSearchService } from './semantic-search.service';

@Module({
  imports: [ConfigModule],
  providers: [SemanticSearchService],
  exports: [SemanticSearchService],
})
export class AiModule {}
