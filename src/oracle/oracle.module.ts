import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OracleAuthService } from './services/oracle-auth.service';
import { ItemLookupService } from './services/item-lookup.service';
import { ItemMasterService } from './services/item-master.service';
import { ItemChildOrgService } from './services/item-child-org.service';
import { InventoryOrganizationsService } from './services/inventory-organizations.service';
import { BusinessUnitService } from './services/business-unit.service';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [HttpModule, ConfigModule, LoggerModule],
  providers: [
    OracleAuthService,
    ItemLookupService,
    ItemMasterService,
    ItemChildOrgService,
    InventoryOrganizationsService,
    BusinessUnitService,
  ],
  exports: [
    OracleAuthService,
    ItemLookupService,
    ItemMasterService,
    ItemChildOrgService,
    InventoryOrganizationsService,
    BusinessUnitService,
  ],
})
export class OracleModule {}
