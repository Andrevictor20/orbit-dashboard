---
name: database-architecture
description: "Revisão e arquitetura de dados (modelagem, índices, concorrência, performance)."
---

# Database Architecture

Antes de implementar funcionalidades que afetam a camada de dados estruturalmente, valide o seguinte:
- Normalização vs desnormalização.
- Integridade referencial (foreign keys, unique constraints).
- Concorrência (isolation, locks).
- Performance (índices adequados, N+1, query plans, pagination).
- Práticas de ORM seguras (evitar SQL dinâmico, cuidado com chamadas crú/raw).
- Pool de conexões e retenção de dados.
