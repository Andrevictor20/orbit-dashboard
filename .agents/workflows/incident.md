---
name: incident
description: "Workflow rápido para mitigação de incidentes em produção."
---
# Incident Workflow

## Flow
detect → stop rollout → rollback/mitigate → verify recovery → document

## Guidelines
- Prioridade máxima: restaurar disponibilidade.
- TDD é obrigatório para o fix definitivo pós-incidente, mas o rollback pode e deve ser instantâneo se suportado pelo pipeline.
