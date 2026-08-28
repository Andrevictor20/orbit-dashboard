---
name: design-tokens
description: "Padrões de tokens visuais e semânticos com Color Consistency Lock e Shape Consistency Lock. Governança de cores desaturadas, raios concêntricos e tipografia parametrizada sem hardcoding."
---

# Design Tokens

Sempre utilize tokens semânticos (`color.background`, `color.surface`, `color.accent`, `radius.outer`, `radius.inner`) em vez de valores brutos espalhados.

---

## 1. Color Consistency Lock

- **1 Acento Principal:** Defina no máximo 1 cor de acento primária com saturação calibrada (< 80%).
- **Bloqueio de Consistência:** A cor de acento é travada para a página inteira. Não altere de roxo no Hero para azul na seção de recursos e verde no rodapé.
- **Paletas Alternativas (Anti-AI Cliché):**
  - *Cold Luxury:* `#F5F6F8` (Fundo claro), `#0B0D10` (Texto), `#1F242D` (Superfície), `#4B68FF` ou `#10B981` (Acento).
  - *Forest:* `#F8F9F5` (Fundo), `#0E1711` (Texto), `#1B2E22` (Superfície profunda), `#D97706` (Acento âmbar).
  - *Black and Tan:* `#0A0A0A` (Fundo escuro), `#EDEDED` (Texto), `#161616` (Superfície), `#C8A265` (Tan suave).
- **Sem Preto Absoluto:** Use off-black matizado (`#0a0a0a`, `#111111`, `#0f172a`) em vez de `#000000` puro.

---

## 2. Shape Consistency Lock & Raios Concêntricos

- **Consistência de Raios:** Escolha uma escala de raio de curvatura e mantenha-a consistente (ex: ou tudo nítido com `4px-8px`, ou tudo suave com `16px-24px`).
- **Matemática Concêntrica (Double-Bezel):** Em containers aninhados, o raio interno deve ser calculado como:
  $$\text{radius}_{\text{inner}} = \max(0, \text{radius}_{\text{outer}} - \text{padding})$$
  Exemplo: `rounded-[2rem]` externo com `p-2` (8px) exige `rounded-[calc(2rem-8px)]` interno para evitar distorção óptica.

---

## 3. Categorias de Tokens
- **Cores Semânticas:** `background`, `surface`, `surface-elevated`, `text-primary`, `text-muted`, `accent`, `border-subtle`.
- **Tipografia:** `font-sans`, `font-display`, `font-mono`, `leading-tight`, `leading-relaxed`, `tracking-tighter`.
- **Espaçamento & Grid:** `gap-section` (`py-24` a `py-32`), `container-max` (`1400px`).
- **Motion & Curvas:** `ease-out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`), `duration-normal` (`300ms`).
