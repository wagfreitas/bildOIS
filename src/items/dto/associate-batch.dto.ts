import { IsArray, ValidateNested, ArrayMinSize, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { AssociateItemDto } from './associate-item.dto';

export class AssociateBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AssociateItemDto)
  items: AssociateItemDto[];

  @IsOptional()
  @IsObject()
  options?: {
    continueOnError?: boolean;
  };
}
