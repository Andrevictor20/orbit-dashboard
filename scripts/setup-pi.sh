#!/usr/bin/env bash
# =============================================================================
# Orbit Dashboard — Raspberry Pi Setup Script
# Run once on the Pi to install Docker, login to ghcr.io and start the stack.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Andrevictor20/orbit-dashboard/main/scripts/setup-pi.sh | bash
# =============================================================================
set -euo pipefail

REPO="Andrevictor20/orbit-dashboard"
IMAGE="ghcr.io/${REPO}:latest"
INSTALL_DIR="${HOME}/orbit"

echo "🚀 Orbit Dashboard — Raspberry Pi Setup"
echo "========================================"

# ── 1. Install Docker if missing ─────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "📦 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "✅ Docker installed. You may need to log out and back in for group membership."
else
  echo "✅ Docker already installed: $(docker --version)"
fi

# ── 2. Create install directory ───────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── 3. Download docker-compose.yml ───────────────────────────────────────────
echo "📥 Downloading docker-compose.yml..."
curl -fsSL "https://raw.githubusercontent.com/${REPO}/main/docker-compose.yml" -o docker-compose.yml

# ── 4. Create .env if it doesn't exist ───────────────────────────────────────
if [ ! -f .env ]; then
  echo ""
  echo "⚙️  Creating .env file..."
  echo "   (You can edit ${INSTALL_DIR}/.env at any time to change credentials)"
  echo ""

  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid | tr -d '-')

  cat > .env << ENV_EOF
# Orbit Dashboard — Production Environment
ORBIT_USERNAME=admin
ORBIT_PASSWORD=changeme_replace_this
JWT_SECRET=${JWT_SECRET}
HOST_PROJECT_PATH=${INSTALL_DIR}
ENV_EOF

  echo "✅ .env created at ${INSTALL_DIR}/.env"
  echo "   ⚠️  Change ORBIT_PASSWORD before going live!"
fi

# ── 5. Login to ghcr.io (public image, anonymous pull works for public repos) ─
echo ""
echo "🔐 Logging in to GitHub Container Registry..."
echo "   (press Enter to skip if the image is public)"
read -rp "   GitHub username (or Enter to skip): " GH_USER
if [ -n "$GH_USER" ]; then
  read -rsp "   GitHub Personal Access Token (read:packages scope): " GH_TOKEN
  echo
  echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin
fi

# ── 6. Pull image and start stack ─────────────────────────────────────────────
echo ""
echo "🐳 Pulling image: ${IMAGE}"
docker pull "${IMAGE}"

echo "▶️  Starting Orbit + Watchtower..."
docker compose up -d

echo ""
echo "✅ Done! Orbit Dashboard is running."
echo ""
echo "   🌐 Access: http://$(hostname -I | awk '{print $1}'):5172"
echo "   📋 Logs:   docker compose logs -f orbit"
echo "   🔄 Updates happen automatically via Watchtower (every 5 min)"
echo ""
