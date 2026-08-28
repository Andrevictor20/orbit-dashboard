---
name: small
description: "Workflow para alterações pequenas (pequeno bugfix, refatoração)."
---
# Small Workflow (L1)

## Flow
Fast Context Bootstrap (.agents/memory/PROJECT_MEMORY.md) → navigator → test-guardian RED → builder GREEN → test-guardian GREEN → refactor → archivist (sync .agents/memory/PROJECT_MEMORY.md) → release

## Guidelines
- Exige TDD (RED/GREEN).
- Exige validação de qualidade antes de liberar.
- Exige sincronização concisa no `.agents/memory/PROJECT_MEMORY.md`.
