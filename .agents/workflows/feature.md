---
name: feature
description: "Workflow adaptativo para novas funcionalidades e endpoints."
---
# Feature Workflow (L2)

## Flow
navigator → specialized analysis → security/design/data as applicable → acceptance criteria → TDD RED → builder GREEN → integration validation → UI validation if applicable → refactor → release

## Guidelines
- Workflow primário para a maior parte das entregas.
- Análise de segurança e design condicional ao impacto da feature, via Capability Routing e Domain Map.
- TDD Enforcement: É PROIBIDO avançar para a fase de implementação no Builder sem um teste de aceitação ou teste unitário configurado para falhar. O Builder exige um Handoff com `tests.status = RED` e uma amostra de `tests.output_snippet`.
