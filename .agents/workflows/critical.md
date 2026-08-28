---
name: critical
description: "Workflow crítico para mudanças arquiteturais, infraestrutura ou auth."
---
# Critical Workflow (L3)

## Flow
Fast Context Bootstrap (.agents/memory/PROJECT_MEMORY.md) → navigator → codebase mapping → architecture/domain analysis → threat model → database/API/design review → acceptance criteria → TDD RED → builder → integration/E2E → security testing → performance/availability if relevant → refactor → CI/security gate → archivist (sync .agents/memory/PROJECT_MEMORY.md & ADRs) → staging → observability window → production → post-release verification

## Guidelines
- Análise minuciosa e aprovação em cada fase.
- Passagem obrigatória por Threat Model e Revisão Arquitetural.
- Registro obrigatório de ADR e sincronização detalhada em `.agents/memory/PROJECT_MEMORY.md`.
