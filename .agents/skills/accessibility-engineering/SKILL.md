---
name: accessibility-engineering
description: "Avaliação de acessibilidade: teclado, contraste, ARIA, focus."
---

# Accessibility Engineering

Todo componente/UI nova deve passar pela verificação de acessibilidade:
- Navegação completa por teclado (Tab, Enter, Space, setas, escape).
- Focus visible e Focus trap onde necessário.
- Semântica correta do HTML (buttons, forms, headings).
- Contraste adequado (texto e focus indicators).
- Motion (`prefers-reduced-motion`).
Acessibilidade crítica quebrada é um bloqueador de release.
