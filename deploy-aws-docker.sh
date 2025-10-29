#!/bin/bash

# Script de deploy Docker para AWS EC2/ECS
# Execute este script no servidor ou em sua máquina local para build

set -e

echo "=== BILD API - Deploy Docker AWS ==="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Variáveis (ajuste conforme necessário)
IMAGE_NAME="bild-api-oracle-fusion"
IMAGE_TAG=${1:-latest}
REGISTRY=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo -e "${RED}Erro: Arquivo .env não encontrado!${NC}"
    exit 1
fi

# 1. Build da imagem
echo -e "${YELLOW}[1/5] Construindo imagem Docker...${NC}"
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

# 2. Testar imagem localmente (opcional)
echo -e "${YELLOW}[2/5] Testando imagem...${NC}"
docker run --rm --env-file .env -p 3000:3000 -d --name test-api ${IMAGE_NAME}:${IMAGE_TAG}
sleep 10
HEALTH_CHECK=$(curl -s http://localhost:3000/api/health | grep -o "healthy" || echo "failed")
docker stop test-api

if [ "$HEALTH_CHECK" != "healthy" ]; then
    echo -e "${RED}Health check falhou!${NC}"
    exit 1
fi
echo -e "${GREEN}Health check OK${NC}"

# 3. Login no ECR (se usando AWS ECR)
if [ ! -z "$AWS_ACCOUNT_ID" ] && [ ! -z "$AWS_REGION" ]; then
    echo -e "${YELLOW}[3/5] Login no AWS ECR...${NC}"
    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${REGISTRY}
    
    # 4. Tag da imagem
    echo -e "${YELLOW}[4/5] Tagueando imagem...${NC}"
    docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${FULL_IMAGE_NAME}
    
    # 5. Push para ECR
    echo -e "${YELLOW}[5/5] Enviando para ECR...${NC}"
    docker push ${FULL_IMAGE_NAME}
    
    echo ""
    echo -e "${GREEN}=== Deploy concluído! ===${NC}"
    echo "Imagem disponível em: ${FULL_IMAGE_NAME}"
else
    echo -e "${YELLOW}[3/5] Pulando push para ECR (configure AWS_ACCOUNT_ID e AWS_REGION)${NC}"
    echo ""
    echo -e "${GREEN}=== Build concluído! ===${NC}"
    echo "Para rodar localmente:"
    echo "  docker-compose -f docker-compose.prod.yml up -d"
fi

echo ""
echo "Comandos úteis:"
echo "  docker logs bild-api-oracle-fusion-prod  # Ver logs"
echo "  docker restart bild-api-oracle-fusion-prod  # Reiniciar"
echo "  docker-compose -f docker-compose.prod.yml down  # Parar"

