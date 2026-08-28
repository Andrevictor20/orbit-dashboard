---
name: integration-testing
description: "Foco em testar fronteiras e integração entre componentes (API, DB), complementando testes unitários e E2E."
---
# Integration Testing

O kit evita transformar todos os testes em E2E. A Pirâmide de Testes é respeitada:
- Unit / Contract: para lógica e contratos de API.
- Integration: para boundaries, banco de dados, chamadas a serviços externos.
- E2E: restrito apenas aos fluxos críticos.

## Diretrizes
- Ao alterar conexões com banco ou APIs, crie testes de integração antes (RED).
- Isole dependências apenas quando estritamente necessário.
- Use Integration Testing para capturar erros que unit tests não veem.
