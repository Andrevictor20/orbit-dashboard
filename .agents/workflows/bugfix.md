---
name: bugfix
description: "Workflow obrigatório para correção de bugs com debugging sistemático, investigação de causa raiz e proibição estrita de workarounds."
---
# Bugfix Workflow

## Flow
Fast Context Bootstrap (`.agents/memory/PROJECT_MEMORY.md`) → **Systematic Debugging (4 Fases: Investigação de Causa Raiz → Análise de Padrões → Hipótese → Teste RED)** → **No-Workarounds Check** → builder → GREEN → full suite → **Code Deslop Review** → refactor → archivist (sync memory & `lesson-learned`) → release

## Diretrizes Inegociáveis
1. **Lei de Ferro do Debugging (`systematic-debugging`):**
   - É expressamente proibido propor ou escrever código de correção antes de investigar a causa raiz exata e rastrear o fluxo de dados até a fonte.
2. **Proibição de Remendos (`no-workarounds`):**
   - A correção deve atuar na fonte do problema. É proibido mascarar erros com `as any`, `@ts-ignore`, catches vazios ou sleeps arbitrários.
3. **Ciclo TDD Estrito:**
   - O teste de regressão DEVE ser criado e comprovadamente estar no estado **RED** antes de qualquer linha de produção ser alterada.
   - O `builder` DEVE recusar a implementação se o estado anterior não contiver a evidência real do teste falhando.
4. **A Regra dos 3 Fixes:**
   - Se 3 tentativas consecutivas de correção falharem, pare e questione a arquitetura antes de tentar qualquer novo remendo.
5. **Sincronização & Lições Aprendidas:**
   - Ao concluir a correção (**GREEN**), o `archivist` deve sincronizar o `PROJECT_MEMORY.md` e registrar a lição aprendida (`lesson-learned`) se o bug envolveu comportamentos não-triviais.
