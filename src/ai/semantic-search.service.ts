import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface SemanticSearchResult {
  organizationCode: string;
  organizationName: string;
  relevanceScore: number;
  reasoning: string;
  category?: string;
}

export interface OrganizationCategory {
  category: string;
  description: string;
  organizations: string[];
  confidence: number;
}

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);
  private openai: OpenAI;
  private organizationsCache: any[] = [];
  private categoriesCache: OrganizationCategory[] = [];
  private lastCacheUpdate: Date | null = null;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey'),
    });
  }

  /**
   * Busca semântica em organizações usando IA
   */
  async searchOrganizations(
    query: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<SemanticSearchResult[]> {
    try {
      this.logger.log(`Iniciando busca semântica: "${query}"`);

      // Buscar organizações se não estiverem em cache
      if (!Array.isArray(this.organizationsCache) || this.organizationsCache.length === 0) {
        await this.refreshOrganizationsCache();
      }

      // Preparar contexto para a IA
      const organizationsArray = Array.isArray(this.organizationsCache) ? this.organizationsCache : [];
      const organizationsContext = organizationsArray
        .slice(0, 50) // Limitar para não sobrecarregar o contexto
        .map(org => `${org.OrganizationCode} - ${org.OrganizationName}`)
        .join('\n');

      const prompt = `
Você é um especialista em análise de organizações de inventário. Analise a consulta do usuário e encontre as organizações mais relevantes.

ORGANIZAÇÕES DISPONÍVEIS:
${organizationsContext}

CONSULTA DO USUÁRIO: "${query}"

INSTRUÇÕES:
1. Analise a consulta e identifique o tipo de organização procurada
2. Retorne as organizações mais relevantes com score de relevância (0.0 a 1.0)
3. Explique brevemente por que cada organização é relevante
4. Categorize quando possível (varejo, distribuição, produção, etc.)

FORMATO DE RESPOSTA (JSON):
{
  "results": [
    {
      "organizationCode": "OI_V30001",
      "organizationName": "OI_V30001", 
      "relevanceScore": 0.95,
      "reasoning": "Organização de varejo especializada em produtos eletrônicos",
      "category": "varejo"
    }
  ]
}

Retorne apenas o JSON válido, sem texto adicional.
`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Resposta vazia da OpenAI');
      }

      // Parse da resposta JSON
      const parsedResponse = JSON.parse(response);
      const results = parsedResponse.results || [];

      // Filtrar por threshold e limitar resultados
      const filteredResults = results
        .filter((result: SemanticSearchResult) => result.relevanceScore >= threshold)
        .slice(0, limit);

      this.logger.log(`Busca semântica concluída: ${filteredResults.length} resultados encontrados`);
      return filteredResults;

    } catch (error) {
      this.logger.error('Erro na busca semântica:', error);
      throw new Error(`Falha na busca semântica: ${error.message}`);
    }
  }

  /**
   * Categoriza automaticamente todas as organizações
   */
  async categorizeOrganizations(): Promise<OrganizationCategory[]> {
    try {
      this.logger.log('Iniciando categorização automática das organizações');

      if (!Array.isArray(this.organizationsCache) || this.organizationsCache.length === 0) {
        await this.refreshOrganizationsCache();
      }

      // Se já temos categorias em cache e são recentes, retornar cache
      if (this.categoriesCache.length > 0 && this.lastCacheUpdate) {
        const cacheAge = Date.now() - this.lastCacheUpdate.getTime();
        if (cacheAge < 30 * 60 * 1000) { // 30 minutos
          this.logger.log('Retornando categorias do cache');
          return this.categoriesCache;
        }
      }

      const organizationsArray = Array.isArray(this.organizationsCache) ? this.organizationsCache : [];
      const organizationsContext = organizationsArray
        .map(org => `${org.OrganizationCode} - ${org.OrganizationName}`)
        .join('\n');

      const prompt = `
Analise as organizações de inventário abaixo e categorize-as por tipo/função.

ORGANIZAÇÕES:
${organizationsContext}

INSTRUÇÕES:
1. Identifique padrões nos códigos e nomes das organizações
2. Crie categorias lógicas (ex: varejo, distribuição, produção, hub, etc.)
3. Agrupe organizações similares
4. Forneça descrição e nível de confiança para cada categoria

FORMATO DE RESPOSTA (JSON):
{
  "categories": [
    {
      "category": "varejo",
      "description": "Organizações de varejo e pontos de venda",
      "organizations": ["OI_V30001", "OI_V30002"],
      "confidence": 0.9
    }
  ]
}

Retorne apenas o JSON válido.
`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1500,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Resposta vazia da OpenAI');
      }

      const parsedResponse = JSON.parse(response);
      this.categoriesCache = parsedResponse.categories || [];
      this.lastCacheUpdate = new Date();

      this.logger.log(`Categorização concluída: ${this.categoriesCache.length} categorias criadas`);
      return this.categoriesCache;

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
  ): Promise<SemanticSearchResult[]> {
    try {
      this.logger.log(`Gerando sugestões para contexto: "${context}"`);

      const query = this.buildSuggestionQuery(context, itemType, region);
      return await this.searchOrganizations(query, 5, 0.6);

    } catch (error) {
      this.logger.error('Erro na geração de sugestões:', error);
      throw new Error(`Falha na geração de sugestões: ${error.message}`);
    }
  }

  /**
   * Busca organizações por categoria
   */
  async getOrganizationsByCategory(category: string): Promise<SemanticSearchResult[]> {
    try {
      this.logger.log(`Buscando organizações da categoria: "${category}"`);

      if (this.categoriesCache.length === 0) {
        await this.categorizeOrganizations();
      }

      const categoryData = this.categoriesCache.find(cat => 
        cat.category.toLowerCase().includes(category.toLowerCase())
      );

      if (!categoryData) {
        return [];
      }

      // Buscar detalhes das organizações da categoria
      const results: SemanticSearchResult[] = [];
      const organizationsArray = Array.isArray(this.organizationsCache) ? this.organizationsCache : [];
      for (const orgCode of categoryData.organizations) {
        const org = organizationsArray.find(o => o.OrganizationCode === orgCode);
        if (org) {
          results.push({
            organizationCode: org.OrganizationCode,
            organizationName: org.OrganizationName,
            relevanceScore: categoryData.confidence,
            reasoning: `Categoria: ${categoryData.description}`,
            category: categoryData.category,
          });
        }
      }

      return results;

    } catch (error) {
      this.logger.error('Erro na busca por categoria:', error);
      throw new Error(`Falha na busca por categoria: ${error.message}`);
    }
  }

  /**
   * Atualiza cache de organizações
   */
  private async refreshOrganizationsCache(): Promise<void> {
    // Esta função será chamada pelo serviço principal
    // Por enquanto, retorna array vazio - será implementada
    this.logger.log('Cache de organizações será atualizado pelo serviço principal');
  }

  /**
   * Define organizações no cache
   */
  setOrganizationsCache(organizations: any[]): void {
    this.organizationsCache = organizations;
    this.logger.log(`Cache de organizações atualizado: ${organizations.length} organizações`);
  }

  /**
   * Constrói query de sugestão baseada em contexto
   */
  private buildSuggestionQuery(context: string, itemType?: string, region?: string): string {
    let query = context;
    
    if (itemType) {
      query += ` para ${itemType}`;
    }
    
    if (region) {
      query += ` na região ${region}`;
    }
    
    return query;
  }

  /**
   * Limpa caches
   */
  clearCache(): void {
    this.organizationsCache = [];
    this.categoriesCache = [];
    this.lastCacheUpdate = null;
    this.logger.log('Caches limpos');
  }
}
