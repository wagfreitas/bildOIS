import { Controller, Post, Get, Body, Param, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ItemAssociationService } from './services/item-association.service';
import { AssociateItemDto } from './dto/associate-item.dto';
import { AssociateBatchDto } from './dto/associate-batch.dto';

@Controller('items')
export class ItemsController {
  private readonly logger = new Logger(ItemsController.name);

  constructor(private readonly itemAssociationService: ItemAssociationService) {}

  @Post('associate')
  async associateItem(@Body() associateItemDto: AssociateItemDto) {
    try {
      this.logger.log('Requisição de associação de item recebida', {
        itemNumber: associateItemDto.itemNumber,
        organizationCode: associateItemDto.organizationCode,
        options: associateItemDto.options,
      });

      const result = await this.itemAssociationService.associateItemToOrganization(
        associateItemDto.itemNumber,
        associateItemDto.organizationCode,
        associateItemDto.options || {}
      );

      this.logger.log('Associação de item concluída com sucesso', {
        itemNumber: associateItemDto.itemNumber,
        organizationCode: associateItemDto.organizationCode,
        operationId: result.operationId,
      });

      return {
        success: true,
        data: result,
        message: 'Item associado com sucesso à organização',
      };

    } catch (error) {
      this.logger.error('Erro na associação de item:', {
        error: error.message,
        stack: error.stack,
        body: associateItemDto,
      });

      throw new HttpException(
        {
          success: false,
          error: error.message,
          code: 'ASSOCIATION_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('associate-batch')
  async associateMultipleItems(@Body() associateBatchDto: AssociateBatchDto) {
    try {
      this.logger.log('Requisição de associação em lote recebida', {
        itemCount: associateBatchDto.items?.length || 0,
        options: associateBatchDto.options,
      });

      const result = await this.itemAssociationService.associateMultipleItems(
        associateBatchDto.items,
        associateBatchDto.options || {}
      );

      this.logger.log('Associação em lote concluída', {
        total: result.total,
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
      });

      return {
        success: true,
        data: result,
        message: `Processamento concluído: ${result.successful}/${result.processed} itens associados com sucesso`,
      };

    } catch (error) {
      this.logger.error('Erro na associação em lote:', {
        error: error.message,
        stack: error.stack,
        body: associateBatchDto,
      });

      throw new HttpException(
        {
          success: false,
          error: error.message,
          code: 'BATCH_ASSOCIATION_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':itemNumber/status/:organizationCode')
  async getItemStatus(
    @Param('itemNumber') itemNumber: string,
    @Param('organizationCode') organizationCode: string,
  ) {
    try {
      this.logger.log('Requisição de status de item recebida', {
        itemNumber,
        organizationCode,
      });

      const result = await this.itemAssociationService.getItemStatus(itemNumber, organizationCode);

      return {
        success: true,
        data: result,
      };

    } catch (error) {
      this.logger.error('Erro ao verificar status do item:', {
        error: error.message,
        stack: error.stack,
        params: { itemNumber, organizationCode },
      });

      throw new HttpException(
        {
          success: false,
          error: error.message,
          code: 'STATUS_CHECK_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('service-info')
  async getServiceInfo() {
    try {
      const info = this.itemAssociationService.getServiceInfo();

      return {
        success: true,
        data: info,
      };

    } catch (error) {
      this.logger.error('Erro ao obter informações do serviço:', error);

      throw new HttpException(
        {
          success: false,
          error: error.message,
          code: 'SERVICE_INFO_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('organizations')
  async getAllOrganizations() {
    try {
      this.logger.log('Requisição de todas as organizações recebida');
      
      const result = await this.itemAssociationService.getAllInventoryOrganizations();
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Erro ao buscar organizações:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get(':itemNumber/organizations')
  async getItemOrganizations(@Param('itemNumber') itemNumber: string) {
    try {
      this.logger.log(`Requisição de organizações do item ${itemNumber} recebida`);
      
      const result = await this.itemAssociationService.getItemAssociatedOrganizations(itemNumber);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar organizações do item ${itemNumber}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get(':itemNumber/missing-organizations')
  async getMissingOrganizations(@Param('itemNumber') itemNumber: string) {
    try {
      this.logger.log(`Requisição de organizações faltantes do item ${itemNumber} recebida`);
      
      const result = await this.itemAssociationService.getMissingOrganizations(itemNumber);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar organizações faltantes do item ${itemNumber}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post(':itemNumber/associate-all')
  async associateToAllOrganizations(
    @Param('itemNumber') itemNumber: string,
    @Body() options: any = {}
  ) {
    try {
      this.logger.log(`Requisição de associação completa do item ${itemNumber} recebida`);
      
      const result = await this.itemAssociationService.associateItemToAllOrganizations(itemNumber, options);
      
      return {
        success: true,
        data: result,
        message: result.message,
      };
    } catch (error) {
      this.logger.error(`Erro na associação completa do item ${itemNumber}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post(':itemNumber/associate-test')
  async associateToLimitedOrganizations(
    @Param('itemNumber') itemNumber: string,
    @Body() body: { limit?: number; options?: any } = {}
  ) {
    try {
      const limit = body.limit || 3;
      this.logger.log(`Requisição de associação de teste do item ${itemNumber} (${limit} organizações) recebida`);
      
      const result = await this.itemAssociationService.associateItemToLimitedOrganizations(
        itemNumber, 
        limit, 
        body.options || {}
      );
      
      return {
        success: true,
        data: result,
        message: result.message,
      };
    } catch (error) {
      this.logger.error(`Erro na associação de teste do item ${itemNumber}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('organizations/:organizationCode/associate-all-items')
  async associateAllItemsToOrganization(
    @Param('organizationCode') organizationCode: string,
    @Body() options: any = {}
  ) {
    try {
      this.logger.log(`Requisição de associação de todos os itens à organização ${organizationCode} recebida`, {
        options,
      });
      
      const result = await this.itemAssociationService.associateAllItemsToOrganization(
        organizationCode,
        options
      );
      
      return {
        success: true,
        data: result,
        message: result.message,
      };
    } catch (error) {
      this.logger.error(`Erro na associação de todos os itens à organização ${organizationCode}:`, error);
      
      throw new HttpException(
        {
          success: false,
          error: error.message,
          code: 'ASSOCIATE_ALL_ITEMS_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ===== ENDPOINTS DE BUSCA SEMÂNTICA =====

  @Get('organizations/search')
  async searchOrganizationsSemantically(
    @Query('q') query: string,
    @Query('limit') limit: string = '10',
    @Query('threshold') threshold: string = '0.7'
  ) {
    try {
      this.logger.log(`Requisição de busca semântica recebida: "${query}"`);
      
      const result = await this.itemAssociationService.searchOrganizationsSemantically(
        query,
        parseInt(limit),
        parseFloat(threshold)
      );
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Erro na busca semântica:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('organizations/categories')
  async categorizeOrganizations() {
    try {
      this.logger.log('Requisição de categorização de organizações recebida');
      
      const result = await this.itemAssociationService.categorizeOrganizations();
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Erro na categorização:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('organizations/suggest')
  async suggestOrganizations(
    @Query('context') context: string,
    @Query('itemType') itemType?: string,
    @Query('region') region?: string
  ) {
    try {
      this.logger.log(`Requisição de sugestões recebida: "${context}"`);
      
      const result = await this.itemAssociationService.suggestOrganizations(
        context,
        itemType,
        region
      );
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Erro na geração de sugestões:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('organizations/category/:category')
  async getOrganizationsByCategory(@Param('category') category: string) {
    try {
      this.logger.log(`Requisição de organizações por categoria recebida: "${category}"`);
      
      const result = await this.itemAssociationService.getOrganizationsByCategory(category);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Erro na busca por categoria:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ===== ENDPOINT DE CONSULTA SEMÂNTICA AVANÇADA =====

  @Post('semantic-query')
  async semanticQuery(@Body() body: { query: string; limit?: number; threshold?: number }) {
    try {
      this.logger.log(`Consulta semântica recebida: "${body.query}"`);
      
      const { query, limit = 20, threshold = 0.6 } = body;
      
      // Analisar o tipo de consulta e direcionar para o método apropriado
      if (query.toLowerCase().includes('itens não associados') || 
          query.toLowerCase().includes('itens sem organização') ||
          query.toLowerCase().includes('itens órfãos')) {
        
        // Buscar itens não associados a nenhuma organização
        const result = await this.itemAssociationService.findUnassociatedItems(limit);
        
        return {
          success: true,
          data: {
            query,
            type: 'unassociated_items',
            result,
            message: `Encontrados ${result.length} itens não associados a organizações`,
          },
        };
      }
      
      if (query.toLowerCase().includes('organizações sem itens') ||
          query.toLowerCase().includes('ois vazias') ||
          query.toLowerCase().includes('organizações órfãs')) {
        
        // Buscar organizações sem itens
        const result = await this.itemAssociationService.findEmptyOrganizations(limit);
        
        return {
          success: true,
          data: {
            query,
            type: 'empty_organizations',
            result,
            message: `Encontradas ${result.length} organizações sem itens`,
          },
        };
      }
      
      if (query.toLowerCase().includes('organizações') && 
          (query.toLowerCase().includes('buscar') || query.toLowerCase().includes('encontrar'))) {
        
        // Busca semântica em organizações
        const result = await this.itemAssociationService.searchOrganizationsSemantically(
          query, 
          limit, 
          threshold
        );
        
        return {
          success: true,
          data: {
            query,
            type: 'organization_search',
            result,
          },
        };
      }
      
      // Consulta genérica - tentar busca semântica
      const result = await this.itemAssociationService.searchOrganizationsSemantically(
        query, 
        limit, 
        threshold
      );
      
      return {
        success: true,
        data: {
          query,
          type: 'generic_search',
          result,
        },
      };
      
    } catch (error) {
      this.logger.error(`Erro na consulta semântica:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
