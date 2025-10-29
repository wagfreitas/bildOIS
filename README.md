# BILD OIS - Oracle Fusion Cloud Integration

API REST para integração com Oracle Fusion Cloud SCM, permitindo associação de itens entre organizações de inventário.

## Funcionalidades

- Associação de item individual a uma organização
- Associação de múltiplos itens em lote (batch)
- Associação de um item a todas as organizações
- Busca e validação de itens e organizações
- Verificação de status de associações
- Logs detalhados com Operation ID

## Requisitos

- Node.js >= 18.x
- npm >= 9.x
- Conta Oracle Fusion Cloud com acesso às APIs REST
- Credenciais de autenticação Oracle (usuário e senha)

## Instalação

```bash
# Clone o repositório
git clone <seu-repositorio>
cd BILD_OIS

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp env.example .env
# Edite o arquivo .env com suas credenciais Oracle
```

## Configuração

Edite o arquivo `.env` com suas configurações:

```env
# Oracle Fusion Cloud
ORACLE_BASE_URL=https://fa-evvi-test-saasfaprod1.fa.ocs.oraclecloud.com
ORACLE_USERNAME=seu.usuario@empresa.com.br
ORACLE_PASSWORD=sua-senha
ORACLE_API_VERSION=11.13.18.05

# Master Organization
MASTER_ORG_CODE=ITEM_MESTRE
MASTER_ORG_ID=300000002473024

# API
PORT=3000
NODE_ENV=development
```

## Uso

### Desenvolvimento
```bash
npm run start:dev
```

### Produção
```bash
npm run build
npm run start:prod
```

### Com PM2
```bash
npm run build
npm run pm2:start
npm run pm2:logs
```

## Endpoints

### Base URL
```
http://localhost:3000/api
```

### Health Check
- `GET /api/health` - Verifica status da API

### Item Association

#### 1. Associar item a uma organização
```bash
POST /api/items/associate

# Exemplo
curl -X POST http://localhost:3000/api/items/associate \
  -H "Content-Type: application/json" \
  -d '{
    "itemNumber": "ATF20477",
    "organizationCode": "OI_B10001"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "itemNumber": "ATF20477",
    "organizationCode": "OI_B10001",
    "masterItem": { "itemId": 300000508116833, ... },
    "childItem": { "itemId": 300000508116833, ... },
    "duration": "8148ms"
  }
}
```

#### 2. Associar múltiplos itens (batch)
```bash
POST /api/items/associate-batch

# Exemplo
curl -X POST http://localhost:3000/api/items/associate-batch \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "itemNumber": "ATF20477", "organizationCode": "OI_B10001" },
      { "itemNumber": "ATF20477", "organizationCode": "OI_B10180" }
    ],
    "options": {
      "continueOnError": true
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processed": 2,
    "successful": 2,
    "failed": 0,
    "results": [ ... ]
  }
}
```

#### 3. Associar um item a TODAS as organizações
```bash
POST /api/items/:itemNumber/associate-all

# Exemplo
curl -X POST http://localhost:3000/api/items/ATF20477/associate-all \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "itemNumber": "ATF20477",
    "totalOrganizations": 500,
    "newAssociations": 260,
    "alreadyExists": 240,
    "failed": 0,
    "duration": "8m 18s"
  }
}
```

#### 4. Verificar organizações associadas a um item
```bash
GET /api/items/:itemNumber/organizations

# Exemplo
curl http://localhost:3000/api/items/ATF20477/organizations
```

**Response:**
```json
{
  "success": true,
  "data": {
    "itemNumber": "ATF20477",
    "totalOrganizations": 240,
    "associatedOrganizations": [
      {
        "organizationCode": "OI_B10001",
        "organizationName": "...",
        "status": "Active"
      }
    ]
  }
}
```

#### 5. Listar todas as organizações disponíveis
```bash
GET /api/items/organizations

# Exemplo
curl http://localhost:3000/api/items/organizations
```

## Estrutura do Projeto

```
BILD_OIS/
├── src/
│   ├── config/                 # Configurações
│   ├── health/                 # Health checks
│   ├── items/                  # Associação de itens
│   │   ├── dto/
│   │   ├── services/
│   │   └── items.controller.ts
│   ├── logger/                 # Sistema de logs
│   ├── oracle/                 # Serviços Oracle
│   │   └── services/
│   │       ├── oracle-auth.service.ts
│   │       ├── item-lookup.service.ts
│   │       ├── item-master.service.ts
│   │       ├── item-child-org.service.ts
│   │       └── inventory-organizations.service.ts
│   ├── app.module.ts
│   └── main.ts
├── dist/                       # Build compilado
├── logs/                       # Logs da aplicação
│   ├── app.log
│   └── error.log
├── scripts/
│   └── setup.sh
├── .env
├── package.json
├── ecosystem.config.js         # Config PM2
└── README.md
```

## Autenticação

A API usa **Basic Authentication** para se autenticar com o Oracle Fusion:

```
Authorization: Basic base64(username:password)
```

As credenciais são configuradas no arquivo `.env` e são gerenciadas automaticamente pelo `OracleAuthService`.

## Logs

Os logs são salvos em `logs/` e incluem:
- **Operation ID**: Identificador único para rastrear cada operação
- **Timestamp**: Data e hora da operação
- **Progress**: Indicadores de progresso para operações longas
- **Summary**: Resumo ao final de cada operação

Exemplo de log durante associação em massa:
```
[INFO] Iniciando associação do item ATF20477 a todas as organizações
[INFO] Item ATF20477 (ID: 300000508116833) será associado a 500 organizações
[INFO] Progresso: 50/500 | 15 novos | 35 já existiam | 0 erros
[INFO] Progresso: 100/500 | 28 novos | 72 já existiam | 0 erros
[INFO] Concluído em 8m 18s: 260 novas associações | 240 já existiam | 0 falhas
```

## Troubleshooting

### Erro: EADDRINUSE (porta 3000 já está em uso)
```bash
# Encontrar processo usando a porta
lsof -ti:3000

# Matar processo
kill -9 $(lsof -ti:3000)
```

### Erro: Item não encontrado
- Verifique se o item existe na Master Organization (ITEM_MESTRE)
- Confirme que está usando o código correto do item

### Erro: Organização não encontrada
- Verifique o código da organização (deve começar com `OI_`)
- Use o endpoint `/api/items/organizations` para listar organizações válidas

### Processo muito lento
- Associações em massa podem levar ~1 segundo por organização
- Use os logs de progresso para acompanhar a execução
- O Oracle Fusion tem rate limits, processos em lote respeitam esses limites

## Docker

```bash
# Build da imagem
npm run docker:build

# Executar container
npm run docker:run

# Com Docker Compose
npm run docker:compose:up
npm run docker:compose:down
```

## Contribuindo

1. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
2. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
3. Push para a branch (`git push origin feature/nova-funcionalidade`)
4. Abra um Pull Request

## Licença

Propriedade de BILD. Todos os direitos reservados.

## Suporte

Em caso de dúvidas ou problemas:
1. Verifique os logs em `logs/`
2. Entre em contato com o time de desenvolvimento

---

**Versão**: 1.0.0  
**Última atualização**: 07/10/2025
