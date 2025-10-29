import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OracleAuthService } from './oracle-auth.service';

@Injectable()
export class ItemChildOrgService {
  private readonly logger = new Logger(ItemChildOrgService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly oracleAuthService: OracleAuthService,
  ) {}

  /**
   * Versão SILENCIOSA para processamento em lote (sem logs)
   * Usa dados do master item já fornecidos para evitar lookup extra
   */
  async associateItemToChildOrgSilent(
    itemId: string, 
    itemNumber: string, 
    organizationCode: string, 
    masterItemData: any,
    itemData: any = {}
  ): Promise<any> {
    const authHeaders = await this.oracleAuthService.getAuthHeaders();
    const baseUrl = this.configService.get<string>('oracle.baseUrl');
    const apiVersion = this.configService.get<string>('oracle.apiVersion');
    
    const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsV2`;
    
    // Payload otimizado: ItemId + ItemNumber + OrganizationCode
    // NÃO enviar ItemClass nem ItemDescription (são controlados pela Master Org)
    const payload = {
      ItemId: itemId,
      ItemNumber: itemNumber,
      OrganizationCode: organizationCode,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }),
      );

      return {
        ItemId: itemId,
        ItemNumber: itemNumber,
        OrganizationCode: organizationCode,
        Status: 'Active',
        AlreadyExists: false,
      };
    } catch (error) {
      // Erro EGP-2775613 ou erro contendo "already exists" = item já existe
      const errorData = error.response?.data || '';
      const errorString = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
      
      if (error.response?.status === 400 && 
          (errorString.includes('EGP-2775613') || 
           errorString.toLowerCase().includes('already exists'))) {
        return {
          ItemId: itemId,
          ItemNumber: itemNumber,
          OrganizationCode: organizationCode,
          Status: 'Active',
          AlreadyExists: true,
        };
      }
      throw error;
    }
  }

  async associateItemToChildOrg(itemId: string, itemNumber: string, organizationCode: string, itemData: any = {}): Promise<any> {
    try {
      this.logger.log(`Associando item ${itemNumber} (ID: ${itemId}) à organização ${organizationCode}`);

      const authHeaders = await this.oracleAuthService.getAuthHeaders();
      const baseUrl = this.configService.get<string>('oracle.baseUrl');
      const apiVersion = this.configService.get<string>('oracle.apiVersion');
      
      // Primeiro, vamos buscar o item da Master Organization para obter todos os dados
      const lookupUrl = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsLOV`;
      const lookupParams = {
        q: `ItemNumber='${itemNumber}'`,
        onlyData: 'true',
      };

      const lookupResponse = await firstValueFrom(
        this.httpService.get(lookupUrl, {
          headers: authHeaders,
          params: lookupParams,
          timeout: 30000,
        }),
      );

      if (!lookupResponse.data?.items?.length) {
        throw new Error('Item não encontrado na Master Organization');
      }

      // Filtrar pela Master Organization
      const masterItem = lookupResponse.data.items.find(item => item.OrganizationCode === 'ITEM_MESTRE');
      
      if (!masterItem) {
        throw new Error('Item não encontrado na Master Organization');
      }
      
      // Verificar se o item já está associado à Child Organization
      const existingChildItem = lookupResponse.data.items.find(item => item.OrganizationCode === organizationCode);
      if (existingChildItem) {
        this.logger.log(`Item ${itemNumber} já está associado à organização ${organizationCode}`, {
          itemId: existingChildItem.ItemId,
          organizationCode: existingChildItem.OrganizationCode,
        });
        return existingChildItem;
      }
      
      // Para associação, vamos usar a API itemsV2 com um payload específico
      // que indica que é uma associação a uma nova organização
      const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsV2`;
      
      // Payload específico para associação de item existente a nova organização
      // Baseado na documentação oficial Oracle Fusion SCM fornecida pelo ChatGPT
      // Usando os valores reais do item master para garantir compatibilidade
      const payload = {
        ItemId: itemId, // ID do item da Master Organization
        OrganizationCode: organizationCode,
        ItemClass: masterItem.ItemClass || 'OBM', // Usar a classe real do item master
        ItemNumber: itemNumber,
        ItemDescription: masterItem.ItemDescription || `Item ${itemNumber}`,
        ItemStatusValue: masterItem.InventoryItemStatusCode || 'Active', // Usar status real do item master
        PrimaryUOMValue: masterItem.PrimaryUOMCode || 'M', // Usar UOM real do item master
        LifecyclePhaseValue: masterItem.CurrentPhaseCode || 'Production', // Usar lifecycle real do item master
      };

      this.logger.log('Payload para associação do item à Child Org:', payload);

      let response;
      try {
        // Usando POST para associação de item existente
        response = await firstValueFrom(
          this.httpService.post(url, payload, {
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json',
            },
            timeout: 60000, // 60 segundos para associação
          }),
        );
      } catch (error) {
        this.logger.error(`Erro ao associar item ${itemNumber} à organização ${organizationCode}:`, {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        // Tratamento de erros específicos
        if (error.response?.status === 400) {
          const errorData = error.response.data;
          this.logger.error('Erro 400 na associação do item:', {
            status: error.response.status,
            data: errorData,
            payload: payload
          });
          
          // Log detalhado do erro do Oracle
          console.error('Fusion error status:', error.response.status);
          console.error('Fusion error body:', JSON.stringify(errorData, null, 2));
          
          // Tratar erro EGP-2775613 como "item já associado" - retornar sucesso
          if (errorData && errorData.includes && errorData.includes('EGP-2775613')) {
            this.logger.log(`Item ${itemNumber} já está associado à organização ${organizationCode} (EGP-2775613)`, {
              itemNumber,
              organizationCode,
              errorCode: 'EGP-2775613'
            });
            
            // Retornar um objeto de sucesso indicando que o item já está associado
            return {
              ItemId: itemId,
              ItemNumber: itemNumber,
              OrganizationCode: organizationCode,
              Status: 'Already Associated',
              Message: 'Item já estava associado à organização'
            };
          }
          
          if (errorData && errorData.detail) {
            throw new Error(`Falha na associação do item (Fusion ${error.response.status}): ${errorData.detail}`);
          }
          if (errorData && errorData.error) {
            throw new Error(`Falha na associação do item (Fusion ${error.response.status}): ${errorData.error}`);
          }
          if (errorData && errorData.title) {
            throw new Error(`Falha na associação do item (Fusion ${error.response.status}): ${errorData.title}`);
          }
          throw new Error(`Falha na associação do item (Fusion ${error.response.status}): ${JSON.stringify(errorData)}`);
        }

        if (error.response?.status === 401) {
          throw new Error('Falha na autenticação. Verifique as credenciais.');
        }

        if (error.response?.status === 403) {
          throw new Error('Acesso negado. Verifique as permissões do usuário.');
        }

        if (error.response?.status === 404) {
          throw new Error('Item ou organização não encontrada.');
        }

        if (error.response?.status === 409) {
          throw new Error('Item já está associado à organização ou há conflito de dados');
        }

        throw new Error(`Falha ao associar item à Child Organization: ${error.response?.statusText || error.message}`);
      }

      if (response.data) {
        this.logger.log(`Item ${itemNumber} associado com sucesso à organização ${organizationCode}`, {
          itemId: response.data.ItemId,
          itemNumber: response.data.ItemNumber,
          organizationCode: response.data.OrganizationCode,
        });
        return response.data;
      }

      throw new Error('Resposta inválida da API Oracle');
    } catch (error) {
      this.logger.error(`Erro ao associar item ${itemNumber} à organização ${organizationCode}:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      throw error;
    }
  }

  async validateOrganization(organizationCode: string): Promise<boolean> {
    try {
      this.logger.log(`Validando organização ${organizationCode}`);
      
      // Aqui você pode implementar validação específica da organização
      // Por enquanto, apenas valida se o código não está vazio
      if (!organizationCode || organizationCode.trim().length === 0) {
        throw new Error('Código da organização é obrigatório');
      }

      // Validação de formato (exemplo: deve começar com OI_)
      if (!organizationCode.startsWith('OI_')) {
        throw new Error('Código da organização deve começar com OI_');
      }

      this.logger.log(`Organização ${organizationCode} é válida`);
      return true;

    } catch (error) {
      this.logger.error(`Erro ao validar organização ${organizationCode}:`, error);
      throw error;
    }
  }
}