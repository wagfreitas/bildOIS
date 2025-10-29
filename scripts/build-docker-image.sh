#!/bin/bash

# Script para construir e publicar imagem Docker
# Uso: ./scripts/build-docker-image.sh [tag] [registry]

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configurações
IMAGE_NAME="bild-api-oracle-fusion"
DEFAULT_TAG="latest"
DEFAULT_REGISTRY=""

# Parâmetros
TAG=${1:-$DEFAULT_TAG}
REGISTRY=${2:-$DEFAULT_REGISTRY}

# Nome completo da imagem
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${TAG}"
else
    FULL_IMAGE_NAME="${IMAGE_NAME}:${TAG}"
fi

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Build e Push Docker Image${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo -e "Image: ${GREEN}${FULL_IMAGE_NAME}${NC}"
echo ""

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Erro: Docker não está rodando!${NC}"
    exit 1
fi

# Build da imagem
echo -e "${YELLOW}[1/3] Construindo imagem...${NC}"
docker build -t "${FULL_IMAGE_NAME}" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build concluído com sucesso!${NC}"
else
    echo -e "${RED}✗ Erro no build!${NC}"
    exit 1
fi

echo ""

# Tag adicional como latest (se não for latest)
if [ "$TAG" != "latest" ]; then
    LATEST_NAME="${IMAGE_NAME}:latest"
    if [ -n "$REGISTRY" ]; then
        LATEST_NAME="${REGISTRY}/${IMAGE_NAME}:latest"
    fi
    echo -e "${YELLOW}[2/3] Criando tag 'latest'...${NC}"
    docker tag "${FULL_IMAGE_NAME}" "${LATEST_NAME}"
    echo -e "${GREEN}✓ Tag 'latest' criada!${NC}"
    echo ""
fi

# Push para registry (se fornecido)
if [ -n "$REGISTRY" ]; then
    echo -e "${YELLOW}[3/3] Fazendo push para registry...${NC}"
    docker push "${FULL_IMAGE_NAME}"
    
    if [ "$TAG" != "latest" ]; then
        docker push "${LATEST_NAME}"
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Push concluído com sucesso!${NC}"
    else
        echo -e "${RED}✗ Erro no push!${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}[3/3] Pulando push (nenhum registry fornecido)${NC}"
    echo -e "${YELLOW}    Para fazer push, forneça o registry:${NC}"
    echo -e "    ${GREEN}./scripts/build-docker-image.sh ${TAG} <registry>${NC}"
    echo ""
    echo -e "    Exemplos:"
    echo -e "    ${GREEN}./scripts/build-docker-image.sh latest docker.io/youruser${NC}"
    echo -e "    ${GREEN}./scripts/build-docker-image.sh v1.0.0 ghcr.io/youruser${NC}"
    echo -e "    ${GREEN}./scripts/build-docker-image.sh latest registry.gitlab.com/yourgroup${NC}"
fi

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}Concluído!${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo -e "Para executar a imagem localmente:"
echo -e "  ${GREEN}docker run -p 3000:3000 --env-file .env ${FULL_IMAGE_NAME}${NC}"
echo ""

