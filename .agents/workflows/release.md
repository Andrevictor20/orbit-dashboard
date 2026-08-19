---
name: release
description: "Workflow de release que conecta CI ao CD (Deploy)."
---
# Release Workflow

## Flow
release-gatekeeper (CI/Security/Evidence gate) → shipper (Staging → Health → Prod → Monitoring)

## Guidelines
- Nenhum deploy ocorre sem que o artefato/commit seja reprodutível e aprovado pelo gatekeeper.
