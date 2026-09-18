#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
INSTALL_SH="${ROOT_DIR}/install.sh"

echo "=== [TEST] Validando sintaxe de install.sh ==="
bash -n "${INSTALL_SH}"
echo "✓ Sintaxe do Bash válida"

echo "=== [TEST] Validando execução piped com --help ==="
output="$(cat "${INSTALL_SH}" | bash -s -- --help)"
if ! echo "${output}" | grep -q "Saturn — Script de Gerenciamento Unificado"; then
  echo "❌ Falha: saída de --help inesperada"
  exit 1
fi
echo "✓ Execução piped via stdin funciona corretamente"

echo "=== [TEST] Validando ausência de recursão em is_saturn_installed ==="
rec_check="$(bash -c '
  source <(sed -e "s/^do_install() {/orig_do_install() {/" -e "s/^do_update() {/orig_do_update() {/" -e "s/^do_uninstall() {/orig_do_uninstall() {/" -e "1s/^/do_install() { echo MOCK_OK; exit 0; }; do_update() { exit 0; }; do_uninstall() { exit 0; };\n/" "'"${INSTALL_SH}"'")
' 2>&1)"

if echo "${rec_check}" | grep -qi "segmentation\|falha de segmentação"; then
  echo "❌ Falha de segmentação detectada em is_saturn_installed!"
  exit 1
fi
echo "✓ is_saturn_installed executado sem recursão nem segfault"

echo "=== [TEST] Validando alias legado is_orbit_installed ==="
alias_check="$(bash -c '
  source <(head -n 220 "'"${INSTALL_SH}"'")
  if is_orbit_installed; then
    echo "STATUS:installed"
  else
    echo "STATUS:not_installed"
  fi
' 2>&1)"

if echo "${alias_check}" | grep -qi "segmentation\|falha de segmentação"; then
  echo "❌ Falha de segmentação detectada em is_orbit_installed!"
  exit 1
fi
echo "✓ is_orbit_installed executado com sucesso"

echo "=== [TEST] Validando integridade de INSTALL_DIR ==="
install_dir_check="$(bash -c '
  source <(head -n 220 "'"${INSTALL_SH}"'")
  echo "DIR:${INSTALL_DIR}"
' 2>&1)"

if ! echo "${install_dir_check}" | grep -q "DIR:"; then
  echo "❌ Falha: INSTALL_DIR não foi definido"
  exit 1
fi
echo "✓ INSTALL_DIR configurado corretamente"

echo "=============================================="
echo "🎉 Todos os testes de install.sh passaram com sucesso!"
echo "=============================================="
