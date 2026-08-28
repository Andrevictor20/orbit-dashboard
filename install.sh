#!/usr/bin/env bash
# =============================================================================
#  ____       _     _ _   
# / __ \_____| |__ (_) |_ 
#/ / / / ___/| '_ \| | __|
#/ /_/ / /    | |_) | | |_ 
#\____/_/     |_.__/|_|\__|
#
# Orbit Dashboard — Universal 1-Command Automated Installer
# Supported: x86_64, aarch64 (ARM64), armv7l (Raspberry Pi 3/4/5, PC, Cloud VPS)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Andrevictor20/orbit-dashboard/main/install.sh | bash
# =============================================================================
set -euo pipefail

# ANSI Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

REPO="Andrevictor20/orbit-dashboard"
IMAGE="ghcr.io/${REPO}:latest"

# ── 0. Banner ─────────────────────────────────────────────────────────────────
clear 2>/dev/null || true
echo -e "${CYAN}${BOLD}"
cat << "EOF"
  ____       _     _ _   
 / __ \_____| |__ (_) |_ 
/ / / / ___/| '_ \| | __|
/ /_/ / /    | |_) | | |_ 
\____/_/     |_.__/|_|\__|
EOF
echo -e "${NC}${BOLD}Orbit Dashboard — Zero-Config Homelab & Docker Manager${NC}"
echo -e "${CYAN}======================================================${NC}\n"

# ── 1. Helper Functions ───────────────────────────────────────────────────────
log_info()    { echo -e "${CYAN}ℹ️  [INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}✅ [SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}⚠️  [WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}❌ [ERROR]${NC} $1"; }

# Check sudo access
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo &>/dev/null; then
    SUDO="sudo"
  else
    log_error "Este instalador requer permissões de administrador (root ou sudo)."
    exit 1
  fi
fi

# ── 1.1 Fix Corrupted Docker Config Directories ───────────────────────────────
# Fix known issue where /root/.docker/config.json or ~/.docker/config.json is accidentally created as a directory
for cfg in "/root/.docker/config.json" "${HOME:-}/.docker/config.json"; do
  if [ -d "${cfg}" ]; then
    $SUDO rm -rf "${cfg}" 2>/dev/null || true
  fi
done

# ── 2. Architecture & OS Detection ────────────────────────────────────────────
ARCH="$(uname -m)"
log_info "Detectando arquitetura do processador: ${BOLD}${ARCH}${NC}"

case "${ARCH}" in
  x86_64|amd64)
    PLATFORM_NAME="x86_64 / AMD64 (PC, Servidor, VPS)"
    ;;
  aarch64|arm64)
    PLATFORM_NAME="ARM64 (Raspberry Pi 4/5, Apple Silicon, ARM Server)"
    ;;
  armv7l|armhf)
    PLATFORM_NAME="ARMv7 (Raspberry Pi 2/3 32-bit)"
    ;;
  *)
    log_warn "Arquitetura '${ARCH}' detectada. Tentando instalação genérica multi-arch..."
    PLATFORM_NAME="${ARCH}"
    ;;
esac
log_success "Plataforma confirmada: ${BOLD}${PLATFORM_NAME}${NC}"

# Detect OS
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_NAME="${PRETTY_NAME:-$ID}"
else
  OS_NAME="$(uname -s)"
fi
log_info "Sistema Operacional detectado: ${BOLD}${OS_NAME}${NC}"

# ── 3. Docker Installation & Verification ─────────────────────────────────────
if ! command -v docker &>/dev/null; then
  log_info "Docker não encontrado. Instalando Docker Engine oficial..."
  curl -fsSL https://get.docker.com | $SUDO sh
  
  if [ -n "${SUDO}" ] && [ -n "${USER:-}" ]; then
    $SUDO usermod -aG docker "$USER" 2>/dev/null || true
  fi
  log_success "Docker instalado com sucesso!"
else
  log_success "Docker já está instalado: $(docker --version)"
fi

# Ensure Docker service is running
if command -v systemctl &>/dev/null; then
  $SUDO systemctl enable --now docker 2>/dev/null || true
fi

# ── 4. Storage & Logging Protection Policy ────────────────────────────────────
log_info "Aplicando configurações de proteção contra esgotamento de disco..."

# 4.1 Docker JSON log limits
if [ ! -f /etc/docker/daemon.json ]; then
  $SUDO mkdir -p /etc/docker
  echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' | $SUDO tee /etc/docker/daemon.json > /dev/null
  $SUDO systemctl restart docker 2>/dev/null || true
fi

# 4.2 Systemd journal vacuuming & limit
if [ -d /etc/systemd/journald.conf.d ]; then
  echo -e "[Journal]\nSystemMaxUse=100M\nSystemMaxFileSize=20M" | $SUDO tee /etc/systemd/journald.conf.d/00-orbit.conf > /dev/null
  $SUDO systemctl restart systemd-journald 2>/dev/null || true
  $SUDO journalctl --vacuum-size=50M 2>/dev/null || true
fi

# ── 5. Directory Setup & DATA Persistence ─────────────────────────────────────
# Determine installation path
if [ -d "/DATA" ] && [ -w "/DATA" ]; then
  INSTALL_DIR="/DATA/orbit"
else
  INSTALL_DIR="${HOME:-/root}/orbit"
fi

log_info "Preparando diretório de instalação: ${BOLD}${INSTALL_DIR}${NC}"
mkdir -p "${INSTALL_DIR}/data"
cd "${INSTALL_DIR}"

# ── 6. Generate docker-compose.yml ───────────────────────────────────────────
log_info "Criando arquivo de configuração docker-compose.yml..."
cat << 'EOF' > docker-compose.yml
services:
  orbit:
    image: ghcr.io/andrevictor20/orbit-dashboard:latest
    container_name: orbit
    restart: unless-stopped
    ports:
      - "5172:5172"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - orbit_data:/app/data
      - /:/host:ro
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  orbit_data:
EOF
log_success "docker-compose.yml configurado com sucesso."

# ── 7. Pull Multi-Arch Image & Start Container ────────────────────────────────
log_info "Baixando imagem multi-arch mais recente (${IMAGE})..."
$SUDO docker compose pull || docker compose pull

log_info "Iniciando container do Orbit Dashboard..."
$SUDO docker compose up -d || docker compose up -d

# ── 8. IP Detection & Final Success Banner ────────────────────────────────────
LOCAL_IP=""
if command -v hostname &>/dev/null; then
  LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
if [ -z "${LOCAL_IP}" ] && command -v ip &>/dev/null; then
  LOCAL_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')"
fi
LOCAL_IP="${LOCAL_IP:-localhost}"

echo -e "\n${GREEN}${BOLD}======================================================${NC}"
echo -e "${GREEN}${BOLD}🎉 Parabéns! O Orbit Dashboard foi instalado com sucesso!${NC}"
echo -e "${GREEN}${BOLD}======================================================${NC}\n"

echo -e "  🌐 ${BOLD}Acesse pelo navegador em:${NC}"
echo -e "     ${CYAN}${BOLD}http://${LOCAL_IP}:5172${NC}\n"

echo -e "  📁 ${BOLD}Diretório de Dados e Configuração:${NC}"
echo -e "     ${INSTALL_DIR}\n"

echo -e "  ⚙️  ${BOLD}Comandos Rápidos:${NC}"
echo -e "     • Ver logs:       ${YELLOW}cd ${INSTALL_DIR} && docker compose logs -f${NC}"
echo -e "     • Reiniciar:      ${YELLOW}cd ${INSTALL_DIR} && docker compose restart${NC}"
echo -e "     • Parar:          ${YELLOW}cd ${INSTALL_DIR} && docker compose down${NC}"
echo -e "     • Atualizar:      ${YELLOW}Diretamente pelo botão de atualização no painel web!${NC}\n"

echo -e "${CYAN}======================================================${NC}"
