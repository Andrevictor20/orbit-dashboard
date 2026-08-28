---
name: codebase-cartography
description: "Mapeamento e impacto estrutural da alteração proposta."
---

# Codebase Cartography

Antes de alterar algo grande (Critical workflow ou refatorações extensas), mapeie os arquivos afetados:
- Quais dependências chamam isso (callers)?
- Quais rotas e modelos são afetados?
- Como estão os testes para essas partes?
- Configurações e impacto estimado.
O `navigator` ou outro analista deve usar essa skill para prover contexto pré-implementação.
