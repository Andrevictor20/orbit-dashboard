---
name: critical
description: "Workflow crítico para mudanças arquiteturais, infraestrutura ou auth."
---
# Critical Workflow (L3)

## Flow
navigator → codebase mapping → architecture/domain analysis → threat model → database/API/design review → acceptance criteria → TDD RED → builder → integration/E2E → security testing → performance/availability if relevant → refactor → CI/security gate → staging → observability window → production → post-release verification

## Guidelines
- Análise minuciosa e aprovação em cada fase.
- Passagem obrigatória por Threat Model e Revisão Arquitetural.
