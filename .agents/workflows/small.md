---
name: small
description: "Workflow para alterações pequenas (pequeno bugfix, refatoração)."
---
# Small Workflow (L1)

## Flow
navigator → test-guardian RED → builder GREEN → test-guardian GREEN → refactor → release

## Guidelines
- Exige TDD (RED/GREEN).
- Exige validação de qualidade antes de liberar.
