---
name: minimalist-ui
description: "Diretiva de engenharia para interfaces ultra-minimalistas, estilo editorial e produtos de alta produtividade (estilo Linear/Notion). Paleta monocromática quente com spot pastels desaturados, contraste tipográfico refinado, bento grids planos (1px border), macro-whitespace generoso e zero sombras pesadas."
---

# Minimalist UI: Utilitarian Minimalism & Editorial Design

> **Propósito:** Criação de interfaces limpas, sofisticadas e com estética de documento/workspace de alta performance. Rejeita ativamente padrões saturados de SaaS genérico.

---

## 1. Restrições Negativas Absolutas (O Que NUNCA Usar)

- **NÃO use fontes genéricas:** `Inter`, `Roboto`, `Arial` ou `Open Sans` como escolhas automáticas.
- **NÃO use sombras pesadas:** `shadow-md`, `shadow-lg`, `shadow-xl` são proibidas. Sombras devem ser quase invisíveis ou ultra-difusas com opacidade < 0.04.
- **NÃO use gradientes chamativos ou cores neon:** Cores são tratadas como recurso raro e escasso.
- **NÃO use `rounded-full` (pílula) para cartões ou containers grandes:** Use cantos nítidos de `4px`, `6px` ou no máximo `8px-12px`.
- **NÃO use emojis:** Substitua por glifos precisos e limpos de bibliotecas reais (Phosphor, Radix).
- **NÃO use dados fake genéricos:** "John Doe", "Acme Corp", "99.9%". Use dados contextuais e naturais (`47.2%`, nomes realistas).

---

## 2. Arquitetura Tipográfica

- **Sans-Serif Primária (Corpo, UI, Botões):** `Geist Sans`, `SF Pro Display`, `Switzer`, `Helvetica Neue`.
- **Serif Editorial (Headlines de Hero & Citações):** `Newsreader`, `Lyon Text`, `PP Editorial New`, `Cormorant Garamond`. Tracking justo (`-0.02em` a `-0.04em`) e line-height compacto (`1.1`).
- **Monospace (Código, Atalhos, Metadados):** `Geist Mono`, `JetBrains Mono`, `IBM Plex Mono`.
- **Cores de Texto:** Texto de corpo NUNCA é `#000000` puro. Use carvão/off-black (`#111111` ou `#2F3437`) com `leading-relaxed` (`1.6`). Texto secundário em cinza suave (`#787774`).

---

## 3. Paleta de Cores (Monocromático Quente + Spot Pastels)

- **Canvas / Fundo:** Branco Puro `#FFFFFF` ou Warm Bone / Off-White `#F7F6F3` / `#FBFBFA`.
- **Superfície Primária (Cards):** `#FFFFFF` ou `#F9F9F8`.
- **Divisores e Bordas Estruturais:** Cinza ultra-claro `#EAEAEA` ou `rgba(0,0,0,0.06)`.
- **Acentos em Pastels Lavados (Exclusivos para tags, inline code, badges):**
  - Pale Red: `#FDEBEC` (Texto: `#9F2F2D`)
  - Pale Blue: `#E1F3FE` (Texto: `#1F6C9F`)
  - Pale Green: `#EDF3EC` (Texto: `#346538`)
  - Pale Yellow: `#FBF3DB` (Texto: `#956400`)

---

## 4. Especificações de Componentes

- **Bento Feature Grids:**
  - Layout CSS Grid assimétrico com `border: 1px solid #EAEAEA`.
  - Border radius nítido: `8px` a `12px` no máximo.
  - Padding interno generoso (`24px` a `40px`).
- **Botões CTA Primários:**
  - Fundo sólido `#111111`, texto `#FFFFFF`.
  - Leve border-radius (`4px` a `6px`). Sem sombras (`box-shadow: none`).
  - Efeito de clique físico com micro-scale `transform: scale(0.98)`.
- **Atalhos de Teclado (Keystroke Micro-UIs):**
  - Tags `<kbd>` físicas com `border: 1px solid #EAEAEA`, `border-radius: 4px`, `background: #F7F6F3` em fonte mono.
- **Accordions (FAQ):**
  - Sem caixas/containers. Itens separados exclusivamente por `border-bottom: 1px solid #EAEAEA` e ícones `+` e `-` limpos.

---

## 5. Motion Sutil & Quase Invisível

- **Scroll Entry:** Elementos entram suavemente com `translateY(12px)` + `opacity: 0` para `translateY(0)` sobre `600ms` usando `cubic-bezier(0.16, 1, 0.3, 1)`. Use `IntersectionObserver`, nunca listeners de scroll no window.
- **Stagger:** Revelação em cascata suave (`delay: index * 80ms`).
- **Animações GPU-Safe:** Apenas `transform` e `opacity`.
