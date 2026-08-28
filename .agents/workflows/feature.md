---
name: feature
description: "Workflow adaptativo para novas funcionalidades e endpoints."
---
# Feature Workflow (L2)

## Flow
Fast Context Bootstrap (.agents/memory/PROJECT_MEMORY.md) → navigator → specialized analysis → security/design/data as applicable → acceptance criteria → TDD RED → builder GREEN → integration validation → UI validation if applicable → refactor → archivist (sync .agents/memory/PROJECT_MEMORY.md) → release

## Guidelines
- Workflow primário para a maior parte das entregas.
- Análise de segurança e design condicional ao impacto da feature, via Capability Routing e Domain Map.
- TDD Enforcement: É PROIBIDO avançar para a fase de implementação no Builder sem um teste de aceitação ou teste unitário configurado para falhar. O Builder exige um Handoff com `tests.status = RED` e uma amostra de `tests.output_snippet`.
- Memory Sync: Antes da aprovação do release, o `archivist` deve registrar a nova feature, arquivos modificados e evidência de testes em `.agents/memory/PROJECT_MEMORY.md`.
