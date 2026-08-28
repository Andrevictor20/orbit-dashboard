---
name: release
description: "Workflow de release que conecta CI ao CD com estratégias de zero-downtime, telemetria e rollback automatizado."
---
# Release Workflow

## Flow
Fast Context Bootstrap (`.agents/memory/PROJECT_MEMORY.md`) → **release-gatekeeper** (CI, Scans SAST/SCA, Assinatura Cosign/SBOM, Evidências) → **archivist** (sync memory & tags) → **shipper** (**Zero-Downtime Deploy: Blue/Green ou Canary** → Startup/Readiness Probes → Telemetria RED pós-deploy → Monitoramento de SLOs)

## Diretrizes Inegociáveis
1. **Gate de Segurança e CI (Gatekeeper):**
   - Nenhum deploy ocorre sem que a suíte completa de CI esteja verde, sem segredos vazados e com a imagem auditada.
2. **Deploy sem Downtime (`zero-downtime-deployment`):**
   - Todo deploy em produção deve utilizar Blue/Green, Canary Releases com progressão gradual (1% $\rightarrow$ 10% $\rightarrow$ 50% $\rightarrow$ 100%) ou Rolling Updates com probes configuradas.
   - Aplicação estrita do padrão Expand-and-Contract para alterações de banco e contratos de API.
3. **Telemetria Pós-Deploy & Rollback Imediato (`observability-and-slo-engineering`):**
   - O `shipper` deve monitorar as métricas RED (Rate, Errors, Duration) e taxas de HTTP 5xx em tempo real.
   - Em caso de degradação da latência p99 > 50% ou taxa de erro 5xx > 1%, o rollback imediato é acionado automaticamente.
4. **Sincronização de Memória:**
   - O `archivist` deve registrar a nova versão/tag e as evidências de release no `PROJECT_MEMORY.md`.
