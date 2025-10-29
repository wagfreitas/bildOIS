import { IsString, IsNotEmpty, IsOptional, IsObject, MaxLength } from 'class-validator';

export class AssociateItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  itemNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  organizationCode: string;

  @IsOptional()
  @IsObject()
  options?: {
    masterItemData?: {
      description?: string;
      itemClass?: string;
      primaryUOM?: string;
      lifecyclePhase?: string;
      status?: string;
    };
    childItemData?: {
      inventoryItemType?: string;
      inventoryPlanningMethod?: string;
    };
  };
}
