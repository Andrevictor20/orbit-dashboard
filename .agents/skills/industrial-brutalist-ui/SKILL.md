---
name: industrial-brutalist-ui
description: "Engenharia de interfaces em brutalismo industrial e telemetria tática. Combina design tipográfico suíço de meados do século com terminais militares aeroespaciais. Grids rígidos de 90° sem border-radius, tipografia neo-grotesque maciça com tracking comprimido, dados densos em monospace, acento vermelho de perigo/aviação e texturas analógicas."
---

# Industrial Brutalism & Tactical Telemetry UI

> **Propósito:** Interfaces mecânicas, densas, precisas e funcionais. Rejeita o design "fofinho" ou amigável padrão em prol de autoridade visual, estética de blueprints e precisão de engenharia.

---

## 1. Arquétipos Visuais (Escolha UM por projeto)

### 1.1 Swiss Industrial Print (Modo Claro)
- Fundo em papel de documentação fosco `#F4F4F0` ou `#EAE8E3`.
- Texto e linhas em tinta carvão sólida `#050505` ou `#111111`.
- Acento único: Vermelho de Perigo / Aviação `#E61919` ou `#FF2A2A` para destaques estruturais e divisores grossos.

### 1.2 Tactical Telemetry & Terminal CRT (Modo Escuro)
- Fundo em CRT desativado `#0A0A0A` ou `#121212` (evite preto absoluto puro).
- Texto principal em fósforo branco `#EAEAEA`.
- Acento: Vermelho de Aviação `#E61919` ou Verde Terminal `#4AF626` (estritamente para indicadores de status específicos).

---

## 2. Arquitetura Tipográfica

### 2.1 Macro-Tipografia (Headers Estruturais)
- **Classificação:** Neo-Grotesque / Heavy Sans-Serif (ex: `Neue Haas Grotesk Black`, `Archivo Black`, `Monument Extended`, `Roboto Flex Heavy`).
- **Escala:** Fluid typography com `clamp(3.5rem, 8vw, 12rem)`.
- **Tracking:** Negativo agressivo (`-0.03em` a `-0.06em`).
- **Leading:** Altamente comprimido (`0.85` a `0.95`).
- **Casing:** Exclusivamente maiúsculas (UPPERCASE) para impacto arquitetural.

### 2.2 Micro-Tipografia (Dados e Telemetria)
- **Classificação:** Monospace Técnico (ex: `JetBrains Mono`, `IBM Plex Mono`, `Space Mono`).
- **Escala:** Pequena e precisa (`11px` a `13px`).
- **Tracking:** Generoso (`0.06em` a `0.1em`).
- **Casing:** Maiúsculas para metadados, coordenadas, status e identificadores de unidades.

---

## 3. Engenharia Espacial e Grids

- **Grid Determinism:** CSS Grid rigoroso (`display: grid; gap: 1px;`) com contrastes de fundo gerando linhas divisórias perfeitas de 1px.
- **Geometria Rígida:** Rejeição absoluta de `border-radius`. Todos os cantos são rigorosamente em 90 graus.
- **Divisores Estruturais:** Uso ostensivo de linhas sólidas horizontais e verticais delimitando zonas de informação.
- **Símbolos e Marcadores Industriais:** Molduras com colchetes técnicos `[ SYS.ONLINE ]`, setas `>>>`, marcas de registro `®`, `™` e miras (`+`) nas interseções dos grids.

---

## 4. Efeitos Analógicos e Degradê

- **CRT Scanlines:** Linhas sutis de feixe de elétrons em CSS:
  ```css
  background-image: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px);
  ```
- **Ruído Mecânico:** Filtro SVG sutil aplicado em camada fixa `pointer-events-none` para quebrar a perfeição vetorial digital.
- **Sem Gradientes ou Sombras Suaves:** A luz é direta e mecânica.
