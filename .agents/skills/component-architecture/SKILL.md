---
name: component-architecture
description: "Design e criação de componentes de UI."
---

# Component Architecture

Regras para criar novos componentes:
- Composition over prop explosion (prefira componentes compostos).
- API pequena e responsabilidade clara.
- Variantes explícitas (Default, Loading, Error, Success, Disabled).
- Acessibilidade integrada nativamente.

Sempre busque reutilizar antes de criar (search existing → patterns → primitives → tokens).
