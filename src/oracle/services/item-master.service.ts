import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OracleAuthService } from './oracle-auth.service';
import { ItemLookupService } from './item-lookup.service';

@Injectable()
export class ItemMasterService {
  private readonly logger = new Logger(ItemMasterService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly oracleAuthService: OracleAuthService,
    private readonly itemLookupService: ItemLookupService,
  ) {}

  async createItemInMasterOrg(itemNumber: string, itemData: any = {}): Promise<any> {
    try {
      const masterOrgCode = this.configService.get<string>('masterOrg.code');
      this.logger.log(`Criando item ${itemNumber} na Master Organization ${masterOrgCode}`);

      // Verifica se o item já existe na Master Org
      const existingItem = await this.itemLookupService.findItemByNumber(itemNumber, masterOrgCode);
      if (existingItem) {
        this.logger.log(`Item ${itemNumber} já existe na Master Organization`, {
          itemId: existingItem.ItemId,
        });
        return existingItem;
      }

      const authHeaders = await this.oracleAuthService.getAuthHeaders();
      const baseUrl = this.configService.get<string>('oracle.baseUrl');
      const apiVersion = this.configService.get<string>('oracle.apiVersion');
      
      const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsV2`;
      
      // Payload mínimo para criação do item na Master Org
      const payload = {
        ItemNumber: itemNumber,
        OrganizationCode: masterOrgCode,
        ItemClass: this.configService.get<string>('masterOrg.defaultItemClass'),
        Description: `Item ${itemNumber}`,
        PrimaryUOM: this.configService.get<string>('masterOrg.defaultUOM'),
        LifecyclePhase: this.configService.get<string>('masterOrg.defaultLifecycle'),
        Status: this.configService.get<string>('masterOrg.defaultStatus'),
      };

      this.logger.log('Payload para criação do item na Master Org:', payload);

      let response;
      try {
        response = await firstValueFrom(
          this.httpService.post(url, payload, {
            headers: authHeaders,
            timeout: 60000, // 60 segundos para criação
          }),
        );
      } catch (error) {
        this.logger.error(`Erro ao criar item ${itemNumber} na Master Organization:`, {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        // Tratamento de erros específicos
        if (error.response?.status === 400) {
          const errorData = error.response.data;
          this.logger.error('Erro 400 na criação do item:', {
            status: error.response.status,
            data: errorData,
            payload: payload
          });
          
          if (errorData && errorData.detail) {
            throw new Error(`Dados inválidos: ${errorData.detail}`);
          }
          if (errorData && errorData.error) {
            throw new Error(`Dados inválidos: ${errorData.error}`);
          }
          throw new Error('Dados inválidos fornecidos para criação do item');
        }

        if (error.response?.status === 401) {
          throw new Error('Falha na autenticação. Verifique as credenciais.');
        }

        if (error.response?.status === 403) {
          throw new Error('Acesso negado. Verifique as permissões do usuário.');
        }

        if (error.response?.status === 409) {
          throw new Error('Item já existe ou há conflito de dados');
        }

        throw new Error(`Falha ao criar item na Master Organization: ${error.response?.statusText || error.message}`);
      }

      if (response.data) {
        this.logger.log(`Item ${itemNumber} criado com sucesso na Master Organization`, {
          itemId: response.data.ItemId,
          itemNumber: response.data.ItemNumber,
          organizationCode: response.data.OrganizationCode,
        });
        return response.data;
      }

      throw new Error('Resposta inválida da API Oracle');
    } catch (error) {
      this.logger.error(`Erro ao criar item ${itemNumber} na Master Organization:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      throw error;
    }
  }

  async ensureItemInMasterOrg(itemNumber: string, itemData: any = {}): Promise<any> {
    try {
      this.logger.log(`Garantindo existência do item ${itemNumber} na Master Organization`);

      // Primeiro, verifica se já existe
      const masterOrgCode = this.configService.get<string>('masterOrg.code');
      const existingItem = await this.itemLookupService.findItemByNumber(itemNumber, masterOrgCode);
      
      if (existingItem) {
        this.logger.log(`Item ${itemNumber} já existe na Master Organization`, {
          itemId: existingItem.ItemId,
        });
        return existingItem;
      }

      // Se não existe, cria o item
      this.logger.log(`Item ${itemNumber} não existe na Master Organization. Criando...`);
      return await this.createItemInMasterOrg(itemNumber, itemData);

    } catch (error) {
      this.logger.error(`Erro ao garantir item ${itemNumber} na Master Organization:`, error);
      throw error;
    }
  }

  getMasterOrgInfo() {
    return {
      masterOrgCode: this.configService.get<string>('masterOrg.code'),
      defaultItemClass: this.configService.get<string>('masterOrg.defaultItemClass'),
      defaultStatus: this.configService.get<string>('masterOrg.defaultStatus'),
      defaultUOM: this.configService.get<string>('masterOrg.defaultUOM'),
      defaultLifecycle: this.configService.get<string>('masterOrg.defaultLifecycle'),
    };
  }
}