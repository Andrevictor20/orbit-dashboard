#!/bin/bash
# test-load.sh
# Safely starts the backend server, runs load tests (k6), and tears down the server.

set -e

PORT=5172
echo "Verificando se a porta $PORT está em uso..."

# Use fuser to find and kill process on port 5172 if it exists
if command -v fuser > /dev/null; then
    fuser -k -n tcp $PORT || true
else
    # Fallback to lsof if fuser is not available
    PID=$(lsof -t -i:$PORT) || true
    if [ ! -z "$PID" ]; then
        echo "Matando processo $PID que está ocupando a porta $PORT..."
        kill -9 $PID
    fi
fi

echo "Iniciando o backend Rust..."
cd backend
cargo run &
BACKEND_PID=$!
cd ..

echo "Aguardando o servidor subir (15s)..."
sleep 15

echo "Rodando o K6 Smoke Test..."
docker run --rm --network host -i grafana/k6 run - < backend/load-tests/swagger_smoke.js

echo "Desligando o backend de teste (PID $BACKEND_PID)..."
kill $BACKEND_PID || true
echo "Teste concluído."
