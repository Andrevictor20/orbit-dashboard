---
name: api-contracts
description: "Design de contratos de API, schemas de request/response e versionamento."
---

# API Contracts

Responsável por garantir contratos sólidos de API:
- Request/Response schemas (DTOs, validação com Zod/Joi/etc).
- Status codes adequados.
- Modelagem de erros padrão.
- Paginação, filtros, idempotência.
- O contrato deve prever compatibilidade frontend/backend sem forçar a lógica pesada de domínio inteiramente para o controller.
