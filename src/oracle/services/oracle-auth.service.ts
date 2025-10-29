import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OracleAuthService {
  private readonly logger = new Logger(OracleAuthService.name);
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private isAuthenticating = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async getValidToken(): Promise<string> {
    try {
      // Se já temos um token válido, retorna ele
      if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.token;
      }

      // Se já está autenticando, aguarda
      if (this.isAuthenticating) {
        await this.waitForAuthentication();
        return this.token;
      }

      // Autentica e obtém novo token
      return await this.authenticate();
    } catch (error) {
      this.logger.error('Erro ao obter token de autenticação:', error);
      throw new Error(`Falha na autenticação Oracle: ${error.message}`);
    }
  }

  private async authenticate(): Promise<string> {
    this.isAuthenticating = true;
    
    try {
      this.logger.log('Iniciando autenticação com Oracle Fusion...');
      
      const baseUrl = this.configService.get<string>('oracle.baseUrl');
      const apiVersion = this.configService.get<string>('oracle.apiVersion');
      const username = this.configService.get<string>('oracle.username');
      const password = this.configService.get<string>('oracle.password');
      
      // Para autenticação, vamos usar um endpoint simples que não requer parâmetros
      const authUrl = `${baseUrl}/fscmRestApi/resources/${apiVersion}/itemsV2?q=ItemNumber='TEST'`;
      
      // Usando Basic Auth conforme especificado no PRD
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      
      const response = await firstValueFrom(
        this.httpService.get(authUrl, {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 30000,
        }),
      );

      // Para Basic Auth, o token é a própria string de credenciais
      this.token = credentials;
      
      // Define expiração para 1 hora (renovação preventiva)
      this.tokenExpiry = Date.now() + (55 * 60 * 1000); // 55 minutos
      
      this.logger.log('Autenticação Oracle realizada com sucesso');
      return this.token;
      
    } catch (error) {
      this.logger.error('Erro na autenticação Oracle:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      
      throw new Error(`Falha na autenticação: ${error.response?.statusText || error.message}`);
    } finally {
      this.isAuthenticating = false;
    }
  }

  private async waitForAuthentication(): Promise<void> {
    const maxWaitTime = 30000; // 30 segundos
    const checkInterval = 100; // 100ms
    let waited = 0;

    while (this.isAuthenticating && waited < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    if (this.isAuthenticating) {
      throw new Error('Timeout na autenticação Oracle');
    }
  }

  invalidateToken(): void {
    this.token = null;
    this.tokenExpiry = null;
    this.logger.log('Token Oracle invalidado');
  }

  isTokenValid(): boolean {
    return this.token && this.tokenExpiry && Date.now() < this.tokenExpiry;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getValidToken();
    
    return {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }
}
