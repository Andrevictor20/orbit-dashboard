# Release & Continuous Delivery Policy

- O `release-gatekeeper` é o gate final de CI. Valida a esteira completa de testes, análise estática, varredura de secrets, assinatura Cosign/SBOM e evidências reais de execução.
- **Autenticação OIDC em Pipelines**: É estritamente proibido o uso de credenciais estáticas de longa duração em pipelines de CI/CD para deploy em nuvem; utilize autenticação federada via OpenID Connect (OIDC).
- **Deploy sem Downtime Mandatório (`zero-downtime-deployment`)**:
  - Todo deploy em produção deve seguir Blue/Green, Canary Releases graduais ou Rolling Updates com Startup, Readiness e Liveness Probes devidamente configuradas.
  - Alterações de banco de dados e APIs devem aplicar o padrão Expand-and-Contract para garantir compatibilidade paralela entre versões.
- **Telemetria Pós-Deploy e SLOs (`observability-and-slo-engineering`)**:
  - O `shipper` deve validar a emissão de logs estruturados com `correlation_id` e monitorar as métricas RED pós-deploy.
- **Rollback Instantâneo Automatizado**:
  - O rollback não é uma intenção teórica: o gatilho de reversão deve estar configurado e automatizado para atuar imediatamente caso as taxas de erro HTTP 5xx ultrapassem 1% ou ocorram falhas em health checks.
