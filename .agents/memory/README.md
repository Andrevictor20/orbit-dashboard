# 🧠 Diretório de Memória Contínua do Projeto (`.agents/memory/`)

Este diretório gerencia a memória viva, o rastreamento de estado e o arquivo histórico do projeto, mantidos pelo agente `archivist` e consumidos pelo `orchestrator` para o **Fast Context Bootstrap**.

## Estrutura do Diretório

```text
.agents/memory/
├── PROJECT_MEMORY.md    # Snapshot ativo (< 300 linhas) lido a cada novo chat
├── README.md            # Guia de governança de memória
└── archive/             # Arquivamento de logs e decisões podadas da memória ativa
    └── HISTORY.md       # Histórico cumulativo de entregas e versões consolidadas
```

## Como Funciona

1. **Memória Ativa (`PROJECT_MEMORY.md`):**
   - É o arquivo consultado imediatamente pelo `orchestrator` no **Passo 0** de qualquer novo chat.
   - Contém o resumo da arquitetura, saúde dos testes, as últimas 5 a 10 entregas e o backlog ativo.
   - Mantido estritamente enxuto (< 2.000 tokens) para evitar desperdício de contexto.

2. **Arquivo Histórico (`archive/HISTORY.md`):**
   - Quando o log de alterações de `PROJECT_MEMORY.md` ultrapassa 10 entradas, as entradas mais antigas são movidas para `archive/HISTORY.md`.
   - Garante que nenhum histórico seja perdido, ao mesmo tempo em que a memória ativa permanece ultra-rápida e barata de ler.
