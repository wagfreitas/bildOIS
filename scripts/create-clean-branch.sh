#!/bin/bash

# Script para criar uma branch limpa sem arquivos sensíveis
# Uso: ./scripts/create-clean-branch.sh [branch-name]

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BRANCH_NAME=${1:-"release/clean"}

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Criando Branch Limpa${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo -e "Branch: ${GREEN}${BRANCH_NAME}${NC}"
echo ""

# Verificar se estamos em um repositório Git
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${YELLOW}Repositório Git não inicializado. Inicializando...${NC}"
    git init
    
    # Se não houver .gitignore, criar um básico
    if [ ! -f .gitignore ]; then
        echo -e "${YELLOW}Criando .gitignore básico...${NC}"
        cat > .gitignore << 'EOF'
node_modules/
.env
.env.local
dist/
logs/
*.log
.DS_Store
coverage/
EOF
    fi
fi

# Verificar branch atual
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")

# Verificar se a branch já existe
if git show-ref --verify --quiet refs/heads/"${BRANCH_NAME}"; then
    echo -e "${YELLOW}Branch ${BRANCH_NAME} já existe.${NC}"
    read -p "Deseja continuar e sobrescrever? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
        echo -e "${RED}Operação cancelada.${NC}"
        exit 1
    fi
    git branch -D "${BRANCH_NAME}" 2>/dev/null || true
fi

# Fazer checkout para branch principal (ou criar main se não existir)
if git show-ref --verify --quiet refs/heads/main; then
    git checkout main
elif git show-ref --verify --quiet refs/heads/master; then
    git checkout master
else
    echo -e "${YELLOW}Criando branch inicial 'main'...${NC}"
    git checkout -b main
fi

# Criar nova branch limpa
echo -e "${YELLOW}[1/4] Criando branch ${BRANCH_NAME}...${NC}"
git checkout -b "${BRANCH_NAME}"

# Verificar se há arquivos não rastreados que devem ser adicionados
echo -e "${YELLOW}[2/4] Verificando arquivos...${NC}"

# Remover arquivos sensíveis do staging se existirem
if [ -f .env ]; then
    echo -e "${YELLOW}Removendo .env do controle de versão...${NC}"
    git rm --cached .env 2>/dev/null || true
fi

# Adicionar arquivos ao staging (exceto os ignorados pelo .gitignore)
echo -e "${YELLOW}[3/4] Adicionando arquivos ao staging...${NC}"
git add .

# Verificar se há mudanças
if git diff --staged --quiet; then
    echo -e "${YELLOW}Nenhuma mudança para commitar.${NC}"
else
    # Fazer commit
    echo -e "${YELLOW}[4/4] Criando commit inicial...${NC}"
    git commit -m "chore: branch limpa para distribuição (sem arquivos sensíveis)" || true
fi

echo ""
echo -e "${GREEN}✓ Branch ${BRANCH_NAME} criada com sucesso!${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo -e "1. Verifique os arquivos: ${GREEN}git status${NC}"
echo -e "2. Certifique-se de que arquivos sensíveis estão no .gitignore"
echo -e "3. Push para o repositório remoto:"
echo -e "   ${GREEN}git push origin ${BRANCH_NAME}${NC}"
echo ""
echo -e "Para fazer push do primeiro commit:"
echo -e "   ${GREEN}git push -u origin ${BRANCH_NAME}${NC}"
echo ""

