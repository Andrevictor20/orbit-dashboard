---
name: bugfix
description: "Workflow obrigatório para correção de bugs."
---
# Bugfix Workflow

## Flow
debugger → reproduce → regression RED → builder → GREEN → full suite → refactor → release

## Guidelines
- Não escrever implementação antes da evidência do teste falhando.
- O teste de regressão DEVE ser criado e estar no estado RED comprovando o bug.
- O Agente Builder DEVE REJEITAR a implementação se o Handoff Contract recebido não contiver `tests.status = RED` e um snippet real de falha em `tests.output_snippet`.
- Após a correção, a evidência de sucesso (`tests.status = GREEN`) deve ser anexada.
