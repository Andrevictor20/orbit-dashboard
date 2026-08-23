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

# ── 4. Removed .env generation ─────────────────────────────────────────────────
# The Orbit backend now automatically generates its own secure JWT_SECRET
# and stores it in the SQLite data volume. No .env configuration is needed!

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

echo "▶️  Starting Orbit Dashboard..."
docker compose up -d

echo ""
echo "✅ Done! Orbit Dashboard is running."
echo ""
echo "   🌐 Access: http://$(hostname -I | awk '{print $1}'):5172"
echo "   📋 Logs:   docker compose logs -f orbit"
echo "   🔄 Updates are managed directly via the Orbit Dashboard UI"
echo ""

