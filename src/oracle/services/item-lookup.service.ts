import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OracleAuthService } from './oracle-auth.service';

@Injectable()
export class ItemLookupService {
  private readonly logger = new Logger(ItemLookupService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly oracleAuthService: OracleAuthService,
  ) {}

  async findItemByNumber(itemNumber: string, organizationCode: string): Promise<any> {
    try {
      this.logger.log(`Buscando item ${itemNumber} na organização ${organizationCode}`);
      
      const authHeaders = await this.oracleAuthService.getAuthHeaders();
      const baseUrl = this.configService.get<string>('oracle.baseUrl');
      const apiVersion = this.configService.get<string>('oracle.apiVersion');
      
      // Usando a API itemsV2 para buscar todas as organizações do item e filtrar localmente
      const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsV2`;
      const params = {
        q: `ItemNumber='${itemNumber}'`,
        onlyData: 'true',
        fields: 'ItemId,ItemNumber,OrganizationCode',
        limit: 1000, // Buscar até 1000 organizações
      };

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: authHeaders,
          params: params,
          timeout: 30000,
        }),
      );

      // Verifica se encontrou resultados e filtra pela organização específica
      if (response.data && response.data.items && response.data.items.length > 0) {
        const item = response.data.items.find(item => item.OrganizationCode === organizationCode);
        
        if (item) {
          this.logger.log(`Item ${itemNumber} encontrado na organização ${organizationCode}`, {
            itemId: item.ItemId,
            itemNumber: item.ItemNumber,
            organizationCode: item.OrganizationCode,
          });
          return item;
        }
      }

      this.logger.log(`Item ${itemNumber} não encontrado na organização ${organizationCode}`);
      return null;

    } catch (error) {
      this.logger.error(`Erro ao buscar item ${itemNumber} na organização ${organizationCode}:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      // Se for erro 404, item não existe (não é erro crítico)
      if (error.response?.status === 404) {
        return null;
      }

      throw new Error(`Falha ao buscar item: ${error.response?.statusText || error.message}`);
    }
  }

  async findItemByNumberLOV(itemNumber: string): Promise<any> {
    try {
      this.logger.log(`Buscando item ${itemNumber} via ItemsLOV`);
      
      const authHeaders = await this.oracleAuthService.getAuthHeaders();
      const baseUrl = this.configService.get<string>('oracle.baseUrl');
      const apiVersion = this.configService.get<string>('oracle.apiVersion');
      
      // Usando a API ItemsLOV
      const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsLOV`;
      const params = {
        q: `ItemNumber='${itemNumber}'`,
      };

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: authHeaders,
          params: params,
          timeout: 30000,
        }),
      );

      // Verifica se encontrou resultados
      if (response.data && response.data.items && response.data.items.length > 0) {
        const item = response.data.items[0];
        this.logger.log(`Item ${itemNumber} encontrado via LOV`, {
          itemId: item.ItemId,
          itemNumber: item.ItemNumber,
        });
        return item;
      }

      this.logger.log(`Item ${itemNumber} não encontrado via LOV`);
      return null;

    } catch (error) {
      this.logger.error(`Erro ao buscar item ${itemNumber} via LOV:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      // Se for erro 404, item não existe (não é erro crítico)
      if (error.response?.status === 404) {
        return null;
      }

      throw new Error(`Falha ao buscar item via LOV: ${error.response?.statusText || error.message}`);
    }
  }

  async existsInMasterOrg(itemNumber: string): Promise<boolean> {
    const masterOrgCode = this.configService.get<string>('masterOrg.code');
    if (!masterOrgCode) {
      throw new Error('MASTER_ORG_CODE não configurado');
    }

    const item = await this.findItemByNumber(itemNumber, masterOrgCode);
    return item !== null;
  }

  async existsInChildOrg(itemNumber: string, organizationCode: string): Promise<boolean> {
    const item = await this.findItemByNumber(itemNumber, organizationCode);
    return item !== null;
  }

  async getItemDetails(itemId: string, organizationCode: string): Promise<any> {
    try {
      this.logger.log(`Obtendo detalhes do item ${itemId} na organização ${organizationCode}`);
      
      const authHeaders = await this.oracleAuthService.getAuthHeaders();
      const baseUrl = this.configService.get<string>('oracle.baseUrl');
      const apiVersion = this.configService.get<string>('oracle.apiVersion');
      
      const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsV2/${itemId}`;
      const params = {
        q: `OrganizationCode='${organizationCode}'`,
      };

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: authHeaders,
          params: params,
          timeout: 30000,
        }),
      );

      if (response.data) {
        this.logger.log(`Detalhes do item ${itemId} obtidos com sucesso`);
        return response.data;
      }

      return null;

    } catch (error) {
      this.logger.error(`Erro ao obter detalhes do item ${itemId}:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      if (error.response?.status === 404) {
        return null;
      }

      throw new Error(`Falha ao obter detalhes do item: ${error.response?.statusText || error.message}`);
    }
  }

  /**
   * Busca itens na Master Organization
   */
  async searchItemsInMasterOrg(query: string = '', limit: number = 50): Promise<any[]> {
    try {
      this.logger.log(`Buscando itens na Master Organization: "${query}"`);

      const authHeaders = await this.oracleAuthService.getAuthHeaders();
      const baseUrl = this.configService.get<string>('oracle.baseUrl');
      const apiVersion = this.configService.get<string>('oracle.apiVersion');
      const masterOrgCode = this.configService.get<string>('masterOrg.code');

      const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsV2`;
      const params = {
        q: query ? `ItemNumber like '%${query}%' and OrganizationCode='${masterOrgCode}'` : `OrganizationCode='${masterOrgCode}'`,
        onlyData: 'true',
        fields: 'ItemId,ItemNumber,ItemDescription,OrganizationCode',
        limit: limit.toString(),
      };

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: authHeaders,
          params: params,
          timeout: 30000,
        }),
      );

      const items = response.data?.items || [];
      this.logger.log(`Encontrados ${items.length} itens na Master Organization`);
      return items;

    } catch (error) {
      this.logger.error('Erro ao buscar itens na Master Organization:', error);
      throw new Error(`Falha ao buscar itens na Master Organization: ${error.message}`);
    }
  }

  /**
   * Busca itens em uma organização específica
   */
  async searchItemsInOrganization(organizationCode: string, query: string = '', limit: number = 50): Promise<any[]> {
    try {
      this.logger.log(`Buscando itens na organização ${organizationCode}: "${query}"`);

      const authHeaders = await this.oracleAuthService.getAuthHeaders();
      const baseUrl = this.configService.get<string>('oracle.baseUrl');
      const apiVersion = this.configService.get<string>('oracle.apiVersion');

      const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsV2`;
      const params = {
        q: query ? `ItemNumber like '%${query}%' and OrganizationCode='${organizationCode}'` : `OrganizationCode='${organizationCode}'`,
        onlyData: 'true',
        fields: 'ItemId,ItemNumber,ItemDescription,OrganizationCode',
        limit: limit.toString(),
      };

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: authHeaders,
          params: params,
          timeout: 30000,
        }),
      );

      const items = response.data?.items || [];
      this.logger.log(`Encontrados ${items.length} itens na organização ${organizationCode}`);
      return items;

    } catch (error) {
      this.logger.error(`Erro ao buscar itens na organização ${organizationCode}:`, error);
      throw new Error(`Falha ao buscar itens na organização ${organizationCode}: ${error.message}`);
    }
  }
}
