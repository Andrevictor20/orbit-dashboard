#!/bin/bash
# run_mutants.sh
# Runs mutation testing locally using cargo-mutants.
# This will inject faults into the code to see if the tests fail.
set -e

if ! command -v cargo-mutants &> /dev/null
then
    echo "cargo-mutants não encontrado. Instalando..."
    cargo install cargo-mutants
fi

echo "Iniciando testes de mutação. Isso pode levar alguns minutos..."
cd backend
cargo mutants --no-shuffle

echo "Mutação finalizada. Consulte os logs em backend/mutants.out/"
