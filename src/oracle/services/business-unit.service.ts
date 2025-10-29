import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OracleAuthService } from './oracle-auth.service';
import { LoggerService } from '../../logger/logger.service';
import axios, { AxiosInstance } from 'axios';

/**
 * Serviço para buscar Business Units (Unidades de Negócio) no Oracle Fusion
 * 
 * Endpoint Oracle: /fscmRestApi/resources/11.13.18.05/businessUnits
 * Documentação: https://docs.oracle.com/en/cloud/saas/procurement/25a/fapra/
 */
@Injectable()
export class BusinessUnitService {
  private axiosInstance: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiVersion: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly oracleAuthService: OracleAuthService,
    private readonly logger: LoggerService,
  ) {
    this.baseUrl = this.configService.get<string>('oracle.baseUrl');
    this.apiVersion = this.configService.get<string>('oracle.apiVersion', '11.13.18.05');

    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Busca uma Business Unit por nome ou código
   * 
   * @param buNameOrCode Nome ou código da Business Unit (ex: "V30326 TRINITA" ou "V30326")
   * @returns Business Unit com ID e informações completas
   */
  async findBusinessUnit(buNameOrCode: string): Promise<any> {
    const operationId = `BU_LOOKUP_${Date.now()}`;
    
    this.logger.log(`Iniciando busca de Business Unit: ${buNameOrCode} [${operationId}]`);

    try {
      // Buscar primeiro pelo nome completo
      let businessUnit = await this.searchByName(buNameOrCode, operationId);

      // Se não encontrar, tentar buscar pelo código (primeira parte antes do espaço)
      if (!businessUnit && buNameOrCode.includes(' ')) {
        const buCode = buNameOrCode.split(' ')[0];
        this.logger.log(`Tentando buscar por código: ${buCode} [${operationId}]`);
        businessUnit = await this.searchByName(buCode, operationId);
      }

      if (!businessUnit) {
        throw new HttpException(
          `Business Unit não encontrada: ${buNameOrCode}`,
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(`Business Unit encontrada com sucesso: ${businessUnit.BUName} (ID: ${businessUnit.BUId}) [${operationId}]`);

      return businessUnit;

    } catch (error) {
      this.logger.error(`Erro ao buscar Business Unit: ${buNameOrCode} - ${error.message} [${operationId}]`, error.stack);
      throw error;
    }
  }

  /**
   * Busca uma Business Unit por ID
   * 
   * @param buId ID da Business Unit
   * @returns Business Unit encontrada
   */
  async findBusinessUnitById(buId: number): Promise<any> {
    const operationId = `BU_LOOKUP_BY_ID_${Date.now()}`;
    
    this.logger.log(`Buscando Business Unit por ID: ${buId} [${operationId}]`);

    try {
      const headers = await this.oracleAuthService.getAuthHeaders();
      const url = `${this.baseUrl}/fscmRestApi/resources/${this.apiVersion}/businessUnits/${buId}`;

      this.logger.log(`Enviando requisição GET para Oracle: ${url} [${operationId}]`);

      const response = await this.axiosInstance.get(url, { headers });

      this.logger.log(`Business Unit encontrada por ID: ${response.data.BUName} (ID: ${response.data.BUId}) [${operationId}]`);

      return response.data;

    } catch (error) {
      if (error.response?.status === 404) {
        throw new HttpException(
          `Business Unit com ID ${buId} não encontrada`,
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.error(`Erro ao buscar Business Unit por ID: ${buId} - ${error.message} (Status: ${error.response?.status}) [${operationId}]`, error.stack);

      throw new HttpException(
        `Erro ao buscar Business Unit: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Busca interna por nome usando query parameter
   */
  private async searchByName(name: string, operationId: string): Promise<any> {
    try {
      const headers = await this.oracleAuthService.getAuthHeaders();
      
      // Query Oracle usando filtro por nome
      // Formato: ?q=BUName='V30326 TRINITA'
      const query = `BUName='${name}'`;
      const url = `${this.baseUrl}/fscmRestApi/resources/${this.apiVersion}/businessUnits`;

      this.logger.log(`Buscando Business Unit na Oracle: ${query} [${operationId}]`);

      const response = await this.axiosInstance.get(url, {
        headers,
        params: {
          q: query,
          limit: 1,
        },
      });

      const items = response.data.items || [];

      if (items.length === 0) {
        this.logger.log(`Business Unit não encontrada: ${name} [${operationId}]`);
        return null;
      }

      return items[0];

    } catch (error) {
      this.logger.error(`Erro na busca de Business Unit: ${name} - ${error.message} (Status: ${error.response?.status}) [${operationId}]`, error.stack);

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new HttpException(
          'Erro de autenticação ao acessar Oracle API',
          HttpStatus.UNAUTHORIZED,
        );
      }

      throw error;
    }
  }

  /**
   * Lista todas as Business Units (com paginação)
   * 
   * @param limit Número máximo de resultados (padrão: 25)
   * @param offset Deslocamento para paginação (padrão: 0)
   * @returns Lista de Business Units
   */
  async listBusinessUnits(limit: number = 25, offset: number = 0): Promise<any> {
    const operationId = `BU_LIST_${Date.now()}`;
    
    this.logger.log(`Listando Business Units (limit: ${limit}, offset: ${offset}) [${operationId}]`);

    try {
      const headers = await this.oracleAuthService.getAuthHeaders();
      // Tentando endpoint de LOV para Business Units
      const url = `${this.baseUrl}/fscmRestApi/resources/${this.apiVersion}/requisitioningBusinessUnitsLOV`;

      this.logger.log(`Tentando URL: ${url} [${operationId}]`);

      const response = await this.axiosInstance.get(url, {
        headers,
        params: {
          limit,
          offset,
        },
      });

      this.logger.log(`Business Units listadas com sucesso: ${response.data.items?.length || 0} itens (Total: ${response.data.count}) [${operationId}]`);

      return {
        items: response.data.items || [],
        count: response.data.count,
        hasMore: response.data.hasMore,
        limit: response.data.limit,
        offset: response.data.offset,
      };

    } catch (error) {
      this.logger.error(`Erro ao listar Business Units: ${error.message} [${operationId}]`, error.stack);

      throw new HttpException(
        `Erro ao listar Business Units: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

