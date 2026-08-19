---
name: task-routing
description: "Roteamento de tarefas baseado em superfícies e capacidades (Capability Routing)."
---

# Task Routing & Capability Routing

Esta skill é usada para determinar **quem precisa trabalhar na tarefa** (Task Routing) antes do handoff. O roteamento não se baseia em tentar adivinhar todas as skills, mas sim no modelo `TASK -> SURFACE -> CAPABILITIES -> SKILLS`.

## Regras de Classificação e Fluxo

Toda tarefa deve seguir a seguinte esteira de classificação:

1. **Risk Level:** L0 (Trivial), L1 (Small), L2 (Feature), L3 (Critical).
   - Não burocratizar tarefas simples (L0).
   - Tarefas críticas (L3) exigem workflows rigorosos, threat modeling e aprovação de segurança explícita.
2. **Surface Detection:** O que está sendo alterado? (frontend, database, api, security, dependencies, etc.)
3. **Capability Mapping:** Baseado na superfície detectada, consulte o Domain Map abaixo para determinar as skills e agentes necessários.
4. **Agent Selection:** Acionar apenas os agentes e skills mapeados. Não realize um "over-route".

## Domain Map

O mapa abaixo define quais capacidades e skills são ativadas para cada superfície:

```yaml
frontend:
  agents:
    - designer
  skills:
    - frontend-architecture
    - accessibility-engineering
    - responsive-architecture
    - visual-regression
    - frontend-performance

design-system:
  agents:
    - designer
  skills:
    - design-tokens
    - component-architecture
    - component-registry
    - design-system-architecture

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
```

O `orchestrator` DEVE utilizar essa matriz para invocar os agentes de forma adaptativa. Não ative skills de banco de dados se a alteração for unicamente no frontend, e vice-versa.
