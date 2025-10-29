import { Injectable, Logger } from '@nestjs/common';
import { ItemMasterService } from '../../oracle/services/item-master.service';
import { ItemChildOrgService } from '../../oracle/services/item-child-org.service';
import { ItemLookupService } from '../../oracle/services/item-lookup.service';
import { InventoryOrganizationsService } from '../../oracle/services/inventory-organizations.service';
import { SemanticSearchService } from '../../ai/semantic-search.service';

@Injectable()
export class ItemAssociationService {
  private readonly logger = new Logger(ItemAssociationService.name);

  constructor(
    private readonly itemMasterService: ItemMasterService,
    private readonly itemChildOrgService: ItemChildOrgService,
    private readonly itemLookupService: ItemLookupService,
    private readonly inventoryOrganizationsService: InventoryOrganizationsService,
    private readonly semanticSearchService: SemanticSearchService,
  ) {}

  async associateItemToOrganization(itemNumber: string, organizationCode: string, options: any = {}): Promise<any> {
    const startTime = Date.now();
    const operationId = this.generateOperationId();

    try {
      this.logger.log(`Iniciando associação do item ${itemNumber} à organização ${organizationCode}`, {
        operationId,
        itemNumber,
        organizationCode,
        options,
      });

      // Validação de entrada
      this.validateInput(itemNumber, organizationCode);

      // Validação da organização
      await this.itemChildOrgService.validateOrganization(organizationCode);

      // Etapa 1: Garantir item na Master Organization
      this.logger.log(`Etapa 1: Garantindo item ${itemNumber} na Master Organization`, { operationId });
      const masterItem = await this.itemMasterService.ensureItemInMasterOrg(
        itemNumber, 
        options.masterItemData || {}
      );

      if (!masterItem || !masterItem.ItemId) {
        throw new Error('Falha ao obter ID do item na Master Organization');
      }

      this.logger.log(`Item ${itemNumber} garantido na Master Organization`, {
        operationId,
        masterItemId: masterItem.ItemId,
      });

      // Etapa 2: Associar item à Child Organization
      this.logger.log(`Etapa 2: Associando item ${itemNumber} à organização ${organizationCode}`, { operationId });
      const childItem = await this.itemChildOrgService.associateItemToChildOrg(
        masterItem.ItemId,
        itemNumber,
        organizationCode,
        options.childItemData || {}
      );

      if (!childItem || !childItem.ItemId) {
        throw new Error('Falha ao obter ID do item na Child Organization');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        success: true,
        operationId,
        itemNumber,
        organizationCode,
        masterItem: {
          itemId: masterItem.ItemId,
          itemNumber: masterItem.ItemNumber,
          organizationCode: masterItem.OrganizationCode,
          status: masterItem.Status,
        },
        childItem: {
          itemId: childItem.ItemId,
          itemNumber: childItem.ItemNumber,
          organizationCode: childItem.OrganizationCode,
          status: childItem.Status,
        },
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      };

      this.logger.log(`Associação do item ${itemNumber} concluída com sucesso`, {
        operationId,
        duration: `${duration}ms`,
        result,
      });

      return result;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.logger.error(`Erro na associação do item ${itemNumber} à organização ${organizationCode}`, {
        operationId,
        error: error.message,
        duration: `${duration}ms`,
      });

      throw new Error(`Falha na associação do item: ${error.message}`);
    }
  }

  async associateMultipleItems(items: any[], options: any = {}): Promise<any> {
    const continueOnError = options.continueOnError !== false; // Default is true
    
    this.logger.log(`Iniciando associação de ${items.length} itens`, {
      continueOnError,
    });

    const results = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        this.logger.log(`Processando item ${i + 1}/${items.length}: ${item.itemNumber}`);
        
        const result = await this.associateItemToOrganization(
          item.itemNumber,
          item.organizationCode,
          item.options || {}
        );
        
        results.push({
          index: i,
          success: true,
          result,
        });

      } catch (error) {
        this.logger.error(`Erro ao processar item ${i + 1}/${items.length}: ${item.itemNumber}`, error);
        
        errors.push({
          index: i,
          itemNumber: item.itemNumber,
          organizationCode: item.organizationCode,
          error: error.message,
        });

        results.push({
          index: i,
          success: false,
          error: error.message,
        });

        // Se continueOnError for false, interrompe o processamento
        if (!continueOnError) {
          this.logger.warn(`Processamento interrompido no item ${i + 1}/${items.length} devido a erro`);
          break;
        }
      }
    }

    const summary = {
      total: items.length,
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: errors.length,
      results,
      errors,
    };

    this.logger.log(`Associação em lote concluída`, summary);

    return summary;
  }

  async getItemStatus(itemNumber: string, organizationCode: string): Promise<any> {
    try {
      this.logger.log(`Verificando status do item ${itemNumber} na organização ${organizationCode}`);

      const item = await this.itemLookupService.findItemByNumber(itemNumber, organizationCode);
      
      if (!item) {
        return {
          exists: false,
          itemNumber,
          organizationCode,
          message: 'Item não encontrado na organização',
        };
      }

      return {
        exists: true,
        itemNumber: item.ItemNumber,
        organizationCode: item.OrganizationCode,
        itemId: item.ItemId,
        status: item.Status,
        itemClass: item.ItemClass,
        primaryUOM: item.PrimaryUOM,
        lifecyclePhase: item.LifecyclePhase,
      };

    } catch (error) {
      this.logger.error(`Erro ao verificar status do item ${itemNumber}:`, error);
      throw new Error(`Falha ao verificar status do item: ${error.message}`);
    }
  }

  private validateInput(itemNumber: string, organizationCode: string): void {
    if (!itemNumber || typeof itemNumber !== 'string' || itemNumber.trim() === '') {
      throw new Error('itemNumber é obrigatório e deve ser uma string não vazia');
    }

    if (!organizationCode || typeof organizationCode !== 'string' || organizationCode.trim() === '') {
      throw new Error('organizationCode é obrigatório e deve ser uma string não vazia');
    }

    // Validações adicionais
    if (itemNumber.length > 50) {
      throw new Error('itemNumber deve ter no máximo 50 caracteres');
    }

    if (organizationCode.length > 50) {
      throw new Error('organizationCode deve ter no máximo 50 caracteres');
    }
  }

  private generateOperationId(): string {
    return `OP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getAllInventoryOrganizations(): Promise<any> {
    try {
      this.logger.log('Buscando todas as organizações de inventário');
      const organizations = await this.inventoryOrganizationsService.getAllInventoryOrganizations();
      
      return {
        success: true,
        total: organizations.length,
        organizations: organizations.map(org => ({
          organizationId: org.OrganizationId,
          organizationCode: org.OrganizationCode,
          organizationName: org.OrganizationName,
        })),
      };
    } catch (error) {
      this.logger.error('Erro ao buscar organizações de inventário:', error);
      throw new Error(`Falha ao buscar organizações: ${error.message}`);
    }
  }

  async getItemAssociatedOrganizations(itemNumber: string): Promise<any> {
    try {
      this.logger.log(`Buscando organizações associadas ao item ${itemNumber}`);
      
      const authHeaders = await this.itemMasterService['oracleAuthService'].getAuthHeaders();
      const baseUrl = this.itemMasterService['configService'].get<string>('oracle.baseUrl');
      const apiVersion = this.itemMasterService['configService'].get<string>('oracle.apiVersion');
      
      const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsV2`;
      const params = {
        q: `ItemNumber='${itemNumber}'`,
        onlyData: 'true',
        fields: 'ItemId,ItemNumber,OrganizationCode',
        limit: 1000,
      };

      const response = await this.itemMasterService['httpService'].get(url, {
        headers: authHeaders,
        params: params,
        timeout: 30000,
      }).toPromise();

      const associatedOrganizations = response.data?.items || [];
      
      this.logger.log(`Item ${itemNumber} está associado a ${associatedOrganizations.length} organizações`);
      
      return {
        success: true,
        itemNumber,
        totalAssociated: associatedOrganizations.length,
        associatedOrganizations: associatedOrganizations.map(item => ({
          itemId: item.ItemId,
          organizationCode: item.OrganizationCode,
        })),
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar organizações associadas ao item ${itemNumber}:`, error);
      throw new Error(`Falha ao buscar organizações associadas: ${error.message}`);
    }
  }

  async getMissingOrganizations(itemNumber: string): Promise<any> {
    try {
      this.logger.log(`Identificando organizações faltantes para o item ${itemNumber}`);
      
      // Buscar todas as organizações disponíveis
      const allOrgsResponse = await this.getAllInventoryOrganizations();
      const allOrganizations = allOrgsResponse.organizations;
      
      // Buscar organizações já associadas ao item
      const associatedResponse = await this.getItemAssociatedOrganizations(itemNumber);
      const associatedOrganizations = associatedResponse.associatedOrganizations;
      
      // Filtrar organizações que ainda não estão associadas
      const associatedCodes = associatedOrganizations.map(org => org.organizationCode);
      const missingOrganizations = allOrganizations.filter(org => 
        !associatedCodes.includes(org.organizationCode)
      );
      
      this.logger.log(`Item ${itemNumber} precisa ser associado a ${missingOrganizations.length} organizações`);
      
      return {
        success: true,
        itemNumber,
        totalAvailable: allOrganizations.length,
        totalAssociated: associatedOrganizations.length,
        totalMissing: missingOrganizations.length,
        missingOrganizations: missingOrganizations.map(org => ({
          organizationId: org.organizationId,
          organizationCode: org.organizationCode,
          organizationName: org.organizationName,
        })),
      };
    } catch (error) {
      this.logger.error(`Erro ao identificar organizações faltantes para o item ${itemNumber}:`, error);
      throw new Error(`Falha ao identificar organizações faltantes: ${error.message}`);
    }
  }

  async associateItemToAllOrganizations(itemNumber: string, options: any = {}): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Iniciando associação do item ${itemNumber} a todas as organizações`);
      
      // ETAPA 1: Garantir item na Master Organization (UMA VEZ APENAS)
      const masterItem = await this.itemMasterService.ensureItemInMasterOrg(
        itemNumber, 
        options.masterItemData || {}
      );
      
      if (!masterItem || !masterItem.ItemId) {
        throw new Error('Falha ao obter ID do item na Master Organization');
      }
      
      // ETAPA 2: Buscar TODAS as organizações disponíveis
      const allOrganizations = await this.inventoryOrganizationsService.getAllInventoryOrganizations();
      
      if (allOrganizations.length === 0) {
        return {
          success: true,
          message: 'Nenhuma organização encontrada',
          itemNumber,
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          results: [],
        };
      }
      
      const totalOrgs = allOrganizations.length;
      this.logger.log(`Item ${itemNumber} (ID: ${masterItem.ItemId}) será associado a ${totalOrgs} organizações`);
      
      const results = [];
      let successful = 0;
      let alreadyExists = 0;
      let failed = 0;
      
      // ETAPA 3: Associar a cada organização (SEM VALIDAÇÕES)
      for (let i = 0; i < totalOrgs; i++) {
        const org = allOrganizations[i];
        const orgCode = org.OrganizationCode;
        
        try {
          // Usar método SILENCIOSO (sem logs internos)
          const result = await this.itemChildOrgService.associateItemToChildOrgSilent(
            masterItem.ItemId,
            itemNumber,
            orgCode,
            masterItem,
            options.childItemData || {}
          );
          
          if (result.AlreadyExists) {
            alreadyExists++;
          } else {
            successful++;
          }
          
          // Log de progresso a cada 50 organizações (para 658 organizações = ~13 logs)
          if ((i + 1) % 50 === 0 || i === 0 || i === totalOrgs - 1) {
            this.logger.log(`Progresso: ${i + 1}/${totalOrgs} | ${successful} novos | ${alreadyExists} já existiam | ${failed} erros`);
          }
          
          results.push({
            organizationCode: orgCode,
            success: true,
            alreadyExists: result.AlreadyExists,
          });
          
        } catch (error) {
          failed++;
          this.logger.error(`${orgCode}: ${error.message}`);
          
          results.push({
            organizationCode: orgCode,
            success: false,
            error: error.message,
          });
        }
      }
      
      const endTime = Date.now();
      const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
      const avgPerOrg = (parseFloat(totalDuration) / totalOrgs).toFixed(2);
      
      const summary = {
        success: true,
        message: `${successful} associados | ${alreadyExists} já existiam | ${failed} erros | ${totalDuration}s`,
        itemNumber,
        totalOrganizations: totalOrgs,
        newAssociations: successful,
        alreadyExists,
        failed,
        duration: `${totalDuration}s`,
        averagePerOrg: `${avgPerOrg}s`,
        results,
      };
      
      this.logger.log(`Concluído: ${successful} novos | ${alreadyExists} já existiam | ${failed} falhas | ${totalDuration}s total`);
      
      return summary;
      
    } catch (error) {
      this.logger.error(`Erro na associação do item ${itemNumber}:`, error);
      throw new Error(`Falha na associação completa: ${error.message}`);
    }
  }

  async associateAllItemsToOrganization(organizationCode: string, options: any = {}): Promise<any> {
    const startTime = Date.now();
    const continueOnError = options.continueOnError !== false; // Default is true
    const limit = options.limit || 1000; // Limite de itens a processar
    
    try {
      this.logger.log(`Iniciando associação de todos os itens à organização ${organizationCode}`, {
        continueOnError,
        limit,
      });
      
      // Validar organização
      await this.itemChildOrgService.validateOrganization(organizationCode);
      
      // Buscar todos os itens da Master Organization
      const allItems = await this.itemLookupService.searchItemsInMasterOrg('', limit);
      
      if (allItems.length === 0) {
        return {
          success: true,
          message: 'Nenhum item encontrado na Master Organization',
          organizationCode,
          totalItems: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          results: [],
        };
      }
      
      this.logger.log(`${allItems.length} itens encontrados na Master Organization`);
      
      const results = [];
      let successful = 0;
      let failed = 0;
      
      // Associar cada item à organização
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        const itemNumber = item.ItemNumber;
        
        try {
          // Log de progresso a cada 10 itens
          if (i % 10 === 0 || i === 0 || i === allItems.length - 1) {
            this.logger.log(`Progresso: ${i + 1}/${allItems.length} - ${itemNumber}`);
          }
          
          // Associar o item diretamente
          // O método associateItemToChildOrg JÁ verifica se existe e retorna o item existente
          const childItem = await this.itemChildOrgService.associateItemToChildOrg(
            item.ItemId,
            itemNumber,
            organizationCode,
            options.itemOptions?.childItemData || {}
          );
          
          results.push({
            itemNumber,
            itemDescription: item.ItemDescription,
            success: true,
            childItemId: childItem.ItemId,
          });
          
          successful++;
          
        } catch (error) {
          this.logger.error(`Erro em ${itemNumber}: ${error.message}`);
          
          results.push({
            itemNumber,
            itemDescription: item.ItemDescription,
            success: false,
            error: error.message,
          });
          
          failed++;
          
          // Se continueOnError for false, interrompe o processamento
          if (!continueOnError) {
            this.logger.warn(`Processamento interrompido no item ${i + 1}/${allItems.length}`);
            break;
          }
        }
      }
      
      const endTime = Date.now();
      const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
      const avgPerItem = (parseFloat(totalDuration) / results.length).toFixed(2);
      
      const summary = {
        success: true,
        message: `Processamento concluído: ${successful} itens processados, ${failed} falharam em ${totalDuration}s`,
        organizationCode,
        totalItems: allItems.length,
        processed: results.length,
        successful,
        failed,
        duration: `${totalDuration}s`,
        averagePerItem: `${avgPerItem}s`,
        results,
      };
      
      this.logger.log(`Associação concluída: ${successful} sucesso, ${failed} falhas, ${totalDuration}s total (${avgPerItem}s/item)`);
      
      return summary;
      
    } catch (error) {
      this.logger.error(`Erro na associação de todos os itens à organização ${organizationCode}:`, error);
      throw new Error(`Falha na associação: ${error.message}`);
    }
  }

  async associateItemToLimitedOrganizations(itemNumber: string, limit: number = 3, options: any = {}): Promise<any> {
    const missingResponse = await this.getMissingOrganizations(itemNumber);
    const limitedOrganizations = missingResponse.missingOrganizations.slice(0, limit);
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    for (const org of limitedOrganizations) {
      try {
        const result = await this.associateItemToOrganization(itemNumber, org.organizationCode, options);
        results.push({ organizationCode: org.organizationCode, organizationName: org.organizationName, success: true, result });
        successful++;
      } catch (error) {
        results.push({ organizationCode: org.organizationCode, organizationName: org.organizationName, success: false, error: error.message });
        failed++;
      }
    }
    
    return {
      success: true,
      message: `Associação de teste concluída: ${successful}/${limitedOrganizations.length} organizações processadas com sucesso`,
      itemNumber,
      totalProcessed: limitedOrganizations.length,
      totalAvailable: missingResponse.missingOrganizations.length,
      successful,
      failed,
      results,
    };
  }

  getServiceInfo(): any {
    return {
      masterOrg: this.itemMasterService.getMasterOrgInfo(),
      version: '1.0.0',
      description: 'Serviço de associação de itens a organizações Oracle Fusion',
    };
  }

  // ===== MÉTODOS DE BUSCA SEMÂNTICA =====

  /**
   * Busca semântica em organizações usando IA
   */
  async searchOrganizationsSemantically(
    query: string, 
    limit: number = 10, 
    threshold: number = 0.7
  ): Promise<any> {
    try {
      this.logger.log(`Iniciando busca semântica: "${query}"`);

      // Atualizar cache de organizações se necessário
      const organizations = await this.getAllInventoryOrganizations();
      this.semanticSearchService.setOrganizationsCache(organizations);

      // Realizar busca semântica
      const results = await this.semanticSearchService.searchOrganizations(query, limit, threshold);

      return {
        success: true,
        query,
        results,
        totalFound: results.length,
        message: `Encontradas ${results.length} organizações relevantes para "${query}"`,
      };

    } catch (error) {
      this.logger.error('Erro na busca semântica:', error);
      throw new Error(`Falha na busca semântica: ${error.message}`);
    }
  }

  /**
   * Categoriza automaticamente todas as organizações
   */
  async categorizeOrganizations(): Promise<any> {
    try {
      this.logger.log('Iniciando categorização automática das organizações');

      // Atualizar cache de organizações
      const organizations = await this.getAllInventoryOrganizations();
      this.semanticSearchService.setOrganizationsCache(organizations);

      // Realizar categorização
      const categories = await this.semanticSearchService.categorizeOrganizations();

      return {
        success: true,
        categories,
        totalCategories: categories.length,
        message: `Criadas ${categories.length} categorias de organizações`,
      };

    } catch (error) {
      this.logger.error('Erro na categorização:', error);
      throw new Error(`Falha na categorização: ${error.message}`);
    }
  }

  /**
   * Sugere organizações baseado em contexto
   */
  async suggestOrganizations(
    context: string, 
    itemType?: string, 
    region?: string
  ): Promise<any> {
    try {
      this.logger.log(`Gerando sugestões para contexto: "${context}"`);

      // Atualizar cache de organizações
      const organizations = await this.getAllInventoryOrganizations();
      this.semanticSearchService.setOrganizationsCache(organizations);

      // Gerar sugestões
      const suggestions = await this.semanticSearchService.suggestOrganizations(context, itemType, region);

      return {
        success: true,
        context,
        itemType,
        region,
        suggestions,
        totalSuggestions: suggestions.length,
        message: `Geradas ${suggestions.length} sugestões para "${context}"`,
      };

    } catch (error) {
      this.logger.error('Erro na geração de sugestões:', error);
      throw new Error(`Falha na geração de sugestões: ${error.message}`);
    }
  }

  /**
   * Busca organizações por categoria
   */
  async getOrganizationsByCategory(category: string): Promise<any> {
    try {
      this.logger.log(`Buscando organizações da categoria: "${category}"`);

      // Atualizar cache de organizações
      const organizations = await this.getAllInventoryOrganizations();
      this.semanticSearchService.setOrganizationsCache(organizations);

      // Buscar por categoria
      const results = await this.semanticSearchService.getOrganizationsByCategory(category);

      return {
        success: true,
        category,
        results,
        totalFound: results.length,
        message: `Encontradas ${results.length} organizações na categoria "${category}"`,
      };

    } catch (error) {
      this.logger.error('Erro na busca por categoria:', error);
      throw new Error(`Falha na busca por categoria: ${error.message}`);
    }
  }

  // ===== MÉTODOS DE CONSULTA SEMÂNTICA AVANÇADA =====

  /**
   * Encontra itens não associados a nenhuma organização
   */
  async findUnassociatedItems(limit: number = 20): Promise<any[]> {
    try {
      this.logger.log('Buscando itens não associados a organizações');

      // Buscar todos os itens da Master Organization
      const allItems = await this.itemLookupService.searchItemsInMasterOrg('', limit * 2);
      
      const unassociatedItems = [];
      
      for (const item of allItems) {
        try {
          // Verificar se o item está associado a alguma organização além da Master
          const associatedOrgs = await this.getItemAssociatedOrganizations(item.ItemNumber);
          
          // Se só tem a Master Organization, o item não está associado a nenhuma OI
          if (associatedOrgs.associatedOrganizations.length <= 1) {
            unassociatedItems.push({
              itemId: item.ItemId,
              itemNumber: item.ItemNumber,
              itemDescription: item.ItemDescription || 'Sem descrição',
              status: 'Não associado',
              onlyMasterOrg: true,
            });
          }
          
          if (unassociatedItems.length >= limit) break;
          
        } catch (error) {
          this.logger.warn(`Erro ao verificar item ${item.ItemNumber}:`, error.message);
        }
      }

      this.logger.log(`Encontrados ${unassociatedItems.length} itens não associados`);
      return unassociatedItems;

    } catch (error) {
      this.logger.error('Erro ao buscar itens não associados:', error);
      throw new Error(`Falha ao buscar itens não associados: ${error.message}`);
    }
  }

  /**
   * Encontra organizações sem itens associados
   */
  async findEmptyOrganizations(limit: number = 20): Promise<any[]> {
    try {
      this.logger.log('Buscando organizações sem itens associados');

      // Buscar todas as organizações
      const allOrganizations = await this.getAllInventoryOrganizations();
      const emptyOrganizations = [];
      
      // Amostra aleatória para não sobrecarregar
      const sampleSize = Math.min(limit * 3, allOrganizations.length);
      const sampleOrgs = allOrganizations.slice(0, sampleSize);
      
      for (const org of sampleOrgs) {
        try {
          // Verificar se a organização tem itens (exceto Master Org)
          if (org.OrganizationCode === 'ITEM_MESTRE') continue;
          
          // Buscar itens nesta organização específica
          const itemsInOrg = await this.itemLookupService.searchItemsInOrganization(
            org.OrganizationCode, 
            '', 
            1
          );
          
          if (itemsInOrg.length === 0) {
            emptyOrganizations.push({
              organizationId: org.OrganizationId,
              organizationCode: org.OrganizationCode,
              organizationName: org.OrganizationName,
              status: 'Vazia',
              itemCount: 0,
            });
          }
          
          if (emptyOrganizations.length >= limit) break;
          
        } catch (error) {
          this.logger.warn(`Erro ao verificar organização ${org.OrganizationCode}:`, error.message);
        }
      }

      this.logger.log(`Encontradas ${emptyOrganizations.length} organizações vazias`);
      return emptyOrganizations;

    } catch (error) {
      this.logger.error('Erro ao buscar organizações vazias:', error);
      throw new Error(`Falha ao buscar organizações vazias: ${error.message}`);
    }
  }
}
