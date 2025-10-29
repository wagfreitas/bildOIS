#!/bin/bash

# Script de deploy para AWS EC2
# Execute este script no servidor EC2

set -e

echo "=== BILD API - Deploy AWS EC2 ==="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Por favor, execute como root ou use sudo${NC}"
  exit 1
fi

# 1. Atualizar sistema
echo -e "${YELLOW}[1/8] Atualizando sistema...${NC}"
apt-get update -y
apt-get upgrade -y

# 2. Instalar Node.js 18
echo -e "${YELLOW}[2/8] Instalando Node.js 18...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# 3. Instalar PM2 globalmente
echo -e "${YELLOW}[3/8] Instalando PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
echo "PM2 version: $(pm2 --version)"

# 4. Criar diretório da aplicação
echo -e "${YELLOW}[4/8] Configurando diretório...${NC}"
APP_DIR="/opt/bild-api"
mkdir -p $APP_DIR
cd $APP_DIR

# 5. Clonar/atualizar repositório (ajuste a URL do seu repo)
echo -e "${YELLOW}[5/8] Atualizando código...${NC}"
# Se já existe, fazer pull, senão clonar
if [ -d ".git" ]; then
    git pull
else
    echo -e "${RED}Configure o repositório Git manualmente${NC}"
    echo "git clone <seu-repositorio> $APP_DIR"
    exit 1
fi

# 6. Instalar dependências e build
echo -e "${YELLOW}[6/8] Instalando dependências...${NC}"
npm ci

echo -e "${YELLOW}[7/8] Compilando aplicação...${NC}"
npm run build

# 7. Configurar variáveis de ambiente
if [ ! -f ".env" ]; then
    echo -e "${RED}Arquivo .env não encontrado!${NC}"
    echo "Crie o arquivo .env com as credenciais Oracle"
    exit 1
fi

# 8. Iniciar/reiniciar aplicação com PM2
echo -e "${YELLOW}[8/8] Iniciando aplicação com PM2...${NC}"
pm2 delete bild-api-oracle-fusion 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

echo ""
echo -e "${GREEN}=== Deploy concluído com sucesso! ===${NC}"
echo ""
echo "Comandos úteis:"
echo "  pm2 logs bild-api-oracle-fusion  # Ver logs"
echo "  pm2 restart bild-api-oracle-fusion  # Reiniciar"
echo "  pm2 monit  # Monitorar em tempo real"
echo ""
echo "API disponível em: http://localhost:3000/api/health"

