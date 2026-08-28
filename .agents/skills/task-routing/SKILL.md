---
name: task-routing
description: "Roteamento de tarefas baseado em superfícies e capacidades (Capability Routing)."
---

# Task Routing & Capability Routing

Esta skill é usada para determinar **quem precisa trabalhar na tarefa** (Task Routing) antes do handoff. O roteamento não se baseia em tentar adivinhar todas as skills, mas sim no modelo `TASK -> SURFACE -> CAPABILITIES -> SKILLS`.

## Regras de Classificação e Fluxo

Toda tarefa deve seguir a seguinte esteira de classificação:

0. **Fast Context Bootstrap:** Leitura em 1 passo do `.agents/memory/PROJECT_MEMORY.md` para carregar contexto arquitetural e últimas alterações sem gasto excessivo de tokens.
1. **Risk Level:** L0 (Trivial), L1 (Small), L2 (Feature), L3 (Critical).
   - Não burocratizar tarefas simples (L0).
   - Tarefas críticas (L3) exigem workflows rigorosos, threat modeling e aprovação de segurança explícita.
2. **Surface Detection:** O que está sendo alterado? (frontend, design-system, copywriting-and-cro, seo-and-ai-search, debugging-and-root-cause, code-review-and-deslop, devops-and-deployment, infrastructure-as-code, observability-and-telemetry, cloud-security-and-zero-trust, database, api, security, dependencies, memory-and-docs, etc.)
3. **Capability Mapping:** Baseado na superfície detectada, consulte o Domain Map abaixo para determinar as skills e agentes necessários.
4. **Agent Selection:** Acionar apenas os agentes e skills mapeados. Não realize um "over-route".

## Domain Map

O mapa abaixo define quais capacidades e skills são ativadas para cada superfície:

```yaml
frontend:
  agents:
    - designer
  skills:
    - frontend-taste-engineering
    - visual-direction-studio
    - conversion-copywriting
    - cro-landing-pages
    - seo-content-engine
    - marketing-psychology
    - copy-editing-sweeps
    - minimalist-ui
    - industrial-brutalist-ui
    - high-end-visual-design
    - redesign-ui-audit
    - image-to-code
    - accessibility-engineering
    - responsive-architecture
    - visual-regression
    - frontend-performance
    - ui-quality-gate

design-system:
  agents:
    - designer
  skills:
    - design-tokens
    - component-architecture
    - component-registry
    - design-system-architecture
    - ui-quality-gate

copywriting-and-cro:
  agents:
    - designer
    - navigator
  skills:
    - conversion-copywriting
    - cro-landing-pages
    - marketing-psychology
    - copy-editing-sweeps

seo-and-ai-search:
  agents:
    - designer
    - navigator
  skills:
    - seo-content-engine
    - conversion-copywriting

debugging-and-root-cause:
  agents:
    - test-guardian
    - builder
  skills:
    - systematic-debugging
    - no-workarounds
    - tdd-safety-net
    - test-evidence-walkthrough

code-review-and-deslop:
  agents:
    - refactor-warden
    - release-gatekeeper
    - builder
  skills:
    - code-deslop-review
    - no-workarounds
    - atomic-commit-discipline
    - ci-security-gate

devops-and-deployment:
  agents:
    - shipper
    - release-gatekeeper
  skills:
    - zero-downtime-deployment
    - observability-and-slo-engineering
    - ci-security-gate

infrastructure-as-code:
  agents:
    - sentinel
    - shipper
  skills:
    - infrastructure-as-code-governance
    - cloud-security-and-zero-trust
    - container-security

observability-and-telemetry:
  agents:
    - shipper
    - sentinel
  skills:
    - observability-and-slo-engineering
    - security-observability

cloud-security-and-zero-trust:
  agents:
    - sentinel
  skills:
    - cloud-security-and-zero-trust
    - infrastructure-as-code-governance
    - threat-modeling
    - secrets-guardian

api:
  skills:
    - api-contracts
    - api-security

database:
  skills:
    - database-architecture
    - migration-safety

security:
  skills:
    - threat-modeling
    - cloud-security-and-zero-trust
    - infrastructure-as-code-governance
    - api-security
    - authentication-security
    - authorization-security
    - availability-security
    - security-testing
    - secrets-guardian
    - crypto-guardian
    - container-security
    - supply-chain-security
    - privacy-review

dependencies:
  skills:
    - dependency-governance
    - supply-chain-security

memory-and-docs:
  agents:
    - archivist
  skills:
    - project-memory
    - living-docs-keeper
    - lesson-learned
```

O `orchestrator` DEVE utilizar essa matriz para invocar os agentes de forma adaptativa.
