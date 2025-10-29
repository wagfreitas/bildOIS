import { Controller, Get, Post, Body, HttpException, HttpStatus, Logger, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ItemAssociationService } from '../items/services/item-association.service';
import { OracleAuthService } from '../oracle/services/oracle-auth.service';
import { ItemMasterService } from '../oracle/services/item-master.service';
import { BusinessUnitService } from '../oracle/services/business-unit.service';
import { ItemLookupService } from '../oracle/services/item-lookup.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly itemAssociationService: ItemAssociationService,
    private readonly oracleAuthService: OracleAuthService,
    private readonly itemMasterService: ItemMasterService,
    private readonly businessUnitService: BusinessUnitService,
    private readonly itemLookupService: ItemLookupService,
  ) {}

  @Get()
  async healthCheck() {
    try {
      // Verifica se as configurações estão válidas
      const serviceInfo = this.itemAssociationService.getServiceInfo();
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'bild-api-oracle-fusion',
        version: serviceInfo.version,
        masterOrg: serviceInfo.masterOrg.masterOrgCode,
        uptime: process.uptime(),
      };

      return health;

    } catch (error) {
      this.logger.error('Erro no health check:', error);

      throw new HttpException(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('config')
  getConfig() {
    return {
      oracle: {
        baseUrl: this.configService.get<string>('oracle.baseUrl'),
        username: this.configService.get<string>('oracle.username'),
        apiVersion: this.configService.get<string>('oracle.apiVersion'),
      },
      masterOrg: {
        code: this.configService.get<string>('masterOrg.code'),
        defaultItemClass: this.configService.get<string>('masterOrg.defaultItemClass'),
        defaultStatus: this.configService.get<string>('masterOrg.defaultStatus'),
        defaultUOM: this.configService.get<string>('masterOrg.defaultUOM'),
        defaultLifecycle: this.configService.get<string>('masterOrg.defaultLifecycle'),
      },
    };
  }

  @Get('auth-test')
  async testAuth() {
    try {
      const authHeaders = await this.oracleAuthService.getAuthHeaders();
      return {
        success: true,
        message: 'Autenticação funcionando',
        hasToken: !!authHeaders.Authorization,
        tokenLength: authHeaders.Authorization?.length || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('test-item-creation')
  async testItemCreation() {
    try {
      const result = await this.itemAssociationService.associateItemToOrganization(
        'TEST123',
        'OI_V30001'
      );
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  @Get('test-master-creation')
  async testMasterCreation() {
    try {
      const result = await this.itemMasterService.createItemInMasterOrg('TEST123');
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Teste de busca de Business Unit
   * 
   * Exemplo: GET /health/test-business-unit?name=V30326 TRINITA
   * ou: GET /health/test-business-unit?name=V30326
   */
  @Get('test-business-unit')
  async testBusinessUnit(@Query('name') name: string) {
    try {
      if (!name) {
        return {
          success: false,
          error: 'Parâmetro "name" é obrigatório',
          example: '/health/test-business-unit?name=V30326 TRINITA',
        };
      }

      this.logger.log(`Testando busca de Business Unit: ${name}`);
      
      const result = await this.businessUnitService.findBusinessUnit(name);
      
      return {
        success: true,
        message: 'Business Unit encontrada com sucesso',
        data: {
          BUId: result.BUId,
          BUName: result.BUName,
          BUCode: result.BUCode,
          Status: result.Status,
          // Incluir outros campos relevantes
          ...result
        }
      };
    } catch (error) {
      this.logger.error('Erro ao testar Business Unit:', error);
      
      return {
        success: false,
        error: error.message,
        status: error.status,
        details: error.response?.data || null,
      };
    }
  }

  /**
   * Lista todas as Business Units
   * 
   * Exemplo: GET /health/list-business-units?limit=10
   */
  @Get('list-business-units')
  async listBusinessUnits(@Query('limit') limit?: string) {
    try {
      const limitNumber = limit ? parseInt(limit, 10) : 25;
      
      this.logger.log(`Listando Business Units (limit: ${limitNumber})`);
      
      const result = await this.businessUnitService.listBusinessUnits(limitNumber);
      
      return {
        success: true,
        message: `${result.items.length} Business Units encontradas`,
        data: result,
      };
    } catch (error) {
      this.logger.error('Erro ao listar Business Units:', error);
      
      return {
        success: false,
        error: error.message,
        status: error.status,
      };
    }
  }

  /**
   * Lista alguns itens do Oracle para testes
   * 
   * Exemplo: GET /health/list-items?limit=5
   */
  @Get('list-items')
  async listItems(@Query('limit') limit?: string) {
    try {
      const limitNumber = limit ? parseInt(limit, 10) : 5;
      const masterOrg = this.configService.get<string>('masterOrg.code', 'ITEM_MESTRE');
      
      this.logger.log(`Listando ${limitNumber} itens`);
      
      // Chamar diretamente a API Oracle LOV
      const headers = await this.oracleAuthService.getAuthHeaders();
      const baseUrl = this.configService.get<string>('oracle.baseUrl');
      const apiVersion = this.configService.get<string>('oracle.apiVersion', '11.13.18.05');
      
      const axios = require('axios');
      const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsLOV`;
      
      this.logger.log(`Buscando itens em: ${url}`);
      
      const response = await axios.get(url, {
        headers,
        params: {
          q: "ItemNumber LIKE 'SVC%'",  // Busca itens que começam com 'SVC'
          limit: limitNumber,
        },
        timeout: 30000,
      });
      
      const items = response.data.items || [];
      const simplifiedItems = items.map(item => ({
        ItemNumber: item.ItemNumber,
        ItemId: item.ItemId,
        Description: item.Description || 'Sem descrição',
      }));
      
      return {
        success: true,
        message: `${simplifiedItems.length} itens encontrados`,
        items: simplifiedItems,
      };
    } catch (error) {
      this.logger.error('Erro ao listar itens:', error);
      
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        details: error.response?.data || null,
      };
    }
  }
}
