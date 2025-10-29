import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OracleAuthService } from './oracle-auth.service';

@Injectable()
export class InventoryOrganizationsService {
  private readonly logger = new Logger(InventoryOrganizationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly oracleAuthService: OracleAuthService,
  ) {}

  async getAllInventoryOrganizations(): Promise<any[]> {
    try {
      this.logger.log('Buscando todas as organizações de inventário disponíveis (com paginação)');
      
      const authHeaders = await this.oracleAuthService.getAuthHeaders();
      const baseUrl = this.configService.get<string>('oracle.baseUrl');
      const apiVersion = this.configService.get<string>('oracle.apiVersion');
      const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/inventoryOrganizations`;
      
      // Array para armazenar todas as organizações de todas as páginas
      const allOrganizations: any[] = [];
      
      // Configuração de paginação
      let offset = 0;
      const limit = 500; // Oracle limita a 500 por página
      let hasMore = true;
      let pageNumber = 1;

      // Loop de paginação - busca todas as páginas
      while (hasMore) {
        this.logger.log(`Buscando página ${pageNumber} (offset: ${offset}, limit: ${limit})`);
        
        const params = {
          onlyData: 'true',
          fields: 'OrganizationId,OrganizationCode,OrganizationName',
          limit: limit.toString(),
          offset: offset.toString(),
        };

        const response = await firstValueFrom(
          this.httpService.get(url, {
            headers: authHeaders,
            params: params,
            timeout: 30000,
          }),
        );

        // Verifica se há dados na resposta
        if (response.data && response.data.items && response.data.items.length > 0) {
          const itemsInPage = response.data.items.length;
          allOrganizations.push(...response.data.items);
          
          this.logger.log(
            `Página ${pageNumber}: ${itemsInPage} organizações | Total acumulado: ${allOrganizations.length}`
          );
          
          // Verifica se há mais páginas
          hasMore = response.data.hasMore === true;
          
          if (hasMore) {
            offset += limit;
            pageNumber++;
          } else {
            this.logger.log(`✅ Paginação concluída. Total de organizações encontradas: ${allOrganizations.length}`);
          }
        } else {
          // Se não houver mais itens, encerra o loop
          hasMore = false;
          this.logger.log('Nenhum item adicional encontrado');
        }
      }

      if (allOrganizations.length === 0) {
        this.logger.log('Nenhuma organização de inventário encontrada');
      }

      return allOrganizations;

    } catch (error) {
      this.logger.error('Erro ao buscar organizações de inventário:', error);
      throw new Error(`Falha ao buscar organizações de inventário: ${error.message}`);
    }
  }

  async getOrganizationByCode(organizationCode: string): Promise<any> {
    try {
      this.logger.log(`Buscando organização ${organizationCode}`);
      
      const authHeaders = await this.oracleAuthService.getAuthHeaders();
      const baseUrl = this.configService.get<string>('oracle.baseUrl');
      const apiVersion = this.configService.get<string>('oracle.apiVersion');
      
      const url = `${baseUrl}/fscmRestApi/resources/${apiVersion}/inventoryOrganizations`;
      const params = {
        q: `OrganizationCode='${organizationCode}'`,
        onlyData: 'true',
        fields: 'OrganizationId,OrganizationCode,OrganizationName',
      };

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: authHeaders,
          params: params,
          timeout: 30000,
        }),
      );

      if (response.data && response.data.items && response.data.items.length > 0) {
        const organization = response.data.items[0];
        this.logger.log(`Organização ${organizationCode} encontrada`, {
          organizationId: organization.OrganizationId,
          organizationName: organization.OrganizationName,
        });
        return organization;
      }

      this.logger.log(`Organização ${organizationCode} não encontrada`);
      return null;

    } catch (error) {
      this.logger.error(`Erro ao buscar organização ${organizationCode}:`, error);
      throw new Error(`Falha ao buscar organização: ${error.message}`);
    }
  }

  async validateOrganization(organizationCode: string): Promise<boolean> {
    try {
      const organization = await this.getOrganizationByCode(organizationCode);
      return organization !== null;
    } catch (error) {
      this.logger.error(`Erro ao validar organização ${organizationCode}:`, error);
      return false;
    }
  }
}
