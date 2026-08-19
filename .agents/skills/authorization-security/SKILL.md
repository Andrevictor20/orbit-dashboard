---
name: authorization-security
description: "Auditoria dos controles de acesso e isolamento de permissões (BOLA/IDOR)."
---

# Authorization Security

Testar e validar:
- Ownership de recursos.
- RBAC e ABAC.
- Function-level e resource-level authorization.
- Isolamento de tenants.
Toda API que recebe IDs deve prever testes de BOLA/IDOR (um tenant/usuário não pode acessar/alterar o ID de outro).
