---
name: frontend-taste-engineering
description: "Framework mestre de engenharia frontend anti-slop e direção estética de alto nível. Elimina layouts genéricos com cara de IA através de inferência de briefing, calibração por três dials (VARIANCE, MOTION, DENSITY), escolha honesta de design systems, skeletons canônicos (Sticky-Stack, Horizontal-Pan, Liquid Glass), banimento absoluto de em-dash (—) e checklist de pré-voo rigoroso."
---

# Frontend Taste Engineering (Anti-Slop Framework)

> **Propósito:** Landing pages, portfólios, aplicações modernas e redesigns que não parecem templates pré-fabricados ou gerados por IA genérica.
> Toda diretriz deste documento é contextual: primeiro faça o **Design Read** do briefing, depois calibre os dials e selecione o design system ou estética nativa apropriada.

---

## 0. BRIEF INFERENCE & DESIGN READ (Ler o Contexto Antes de Qualquer Código)

A maior causa de interfaces ruins geradas por IA é o modelo pular direto para código adotando um default seguro (ex: fundo escuro com glow roxo, Inter em tudo, 3 cards simétricos).

### 0.A Sinais a Inspecionar Primeiro
1. **Tipo de Página:** Landing (SaaS B2B, Consumer, Agência, Evento), Portfólio (Dev, Designer, Estúdio), Redesign (Preservação vs Overhaul), Editorial / Blog.
2. **Palavras de Vibe do Usuário:** "Minimalista", "Calmo", "Linear-style", "Awwwards", "Brutalista", "Apple-like", "Playful", "B2B Sério", "Editorial", "Dark Tech".
3. **Sinais de Referência:** URLs citadas, marcas concorrentes, screenshots anexados.
4. **Público-Alvo:** Compradores corporativos B2B vs Consumidor exigente vs Recrutadores de design. O público dita a estética, não a preferência pessoal da IA.
5. **Restrições Silenciosas:** Acessibilidade crítica, setor público, fintechs reguladas, e-commerce de alta confiança. Essas restrições SOBREPÕEM preferências estéticas.

### 0.B Declaração de "Design Read" Obrigatória
Antes de gerar qualquer código de UI, declare em uma única linha:  
**"Reading this as: \<tipo de página> para \<público>, com linguagem \<vibe>, direcionado para \<design system ou família estética>."**

### 0.C Disciplina Anti-Default (O que NUNCA fazer por reflexo)
Não use por default: gradientes roxos/azuis de IA, hero centralizado sobre malha escura, 3 cards de features idênticos, glassmorphism genérico em tudo, micro-animações infinitas em todos os elementos, Inter + slate-900.

---

## 1. OS TRÊS DIALS (Configuração Central de Calibração)

Após o Design Read, calibre os três dials fundamentais (escala de 1 a 10):

* **`DESIGN_VARIANCE: 8`** — `1` = Simetria Perfeita / Conservador, `10` = Caos Artístico / Assimétrico
* **`MOTION_INTENSITY: 6`** — `1` = Estático (Apenas Hover), `10` = Cinemático / Scroll-Hijack / Física
* **`VISUAL_DENSITY: 4`** — `1` = Galeria de Arte / Ultra Espaçoso, `10` = Cockpit / Alta Densidade de Dados

**Baseline Geral:** `8 / 6 / 4` (Ajustado dinamicamente pelo briefing).

### Tabela de Presets de Dials por Caso de Uso
| Caso de Uso / Sinal | VARIANCE | MOTION | DENSITY |
| :--- | :--- | :--- | :--- |
| Minimalista / Calmo / Editorial / Linear-style | 5-6 | 3-4 | 2-3 |
| Consumidor Premium / Apple-like / Luxo | 7-8 | 5-7 | 3-4 |
| Criativo / Awwwards / Experimental / Agência | 9-10 | 8-10 | 3-4 |
| Landing Page SaaS (Mainstream) | 7 | 6 | 4 |
| Portfólio (Designer / Estúdio Criativo) | 8 | 7 | 3 |
| Portfólio (Desenvolvedor) | 6 | 5 | 4 |
| Setor Público / Regulado / Alta Acessibilidade | 3-4 | 2-3 | 4-5 |
| Redesign — Modo Preservação | match atual | +1 | match atual |
| Redesign — Modo Overhaul | +2 | +2 | match atual |

---

## 2. BRIEF → MAPA DE DESIGN SYSTEMS

Não invente CSS do zero para padrões que possuem pacotes oficiais maduros:

### 2.A Quando usar Design Systems Oficiais
- **Enterprise / B2B SaaS / Dashboards Microsoft:** `@fluentui/react-components` (Fluent UI 9).
- **Google / Material Product:** `@material/web` + Material 3 Tokens.
- **IBM / Data Analytics Enterprise:** `@carbon/react` + `@carbon/styles`.
- **Shopify Apps:** `@shopify/polaris` / Polaris Web Components.
- **Atlassian / Ferramentas de Produtividade:** `@atlaskit/*` + `@atlaskit/tokens`.
- **DevTools / GitHub Style:** `@primer/css` ou `@primer/react-brand`.
- **Serviços Públicos:** `govuk-frontend` ou `uswds`.
- **React Moderno com Componentes Próprios:** `shadcn/ui` (`npx shadcn@latest add ...`) — customize tokens, nunca entregue no estado default puro.
- **Fundação Acessível & Temas:** `@radix-ui/themes`.

### 2.B Quando a Direção é uma Estética Nativa
- **Glassmorphism / Vidro Fosco:** `backdrop-filter`, bordas duplas em camadas e realce interno. Fornecer fallback sólido para `prefers-reduced-transparency`.
- **Bento Grid:** CSS Grid com células assimétricas mistas.
- **Brutalismo Industrial:** CSS nativo, tipografia monospace/neo-grotesque, bordas duras de 90°.
- **Editorial / Revista:** Tipografia com personalidade, grid assimétrico, espaços em branco generosos.
- **Dark Tech:** Tipografia mono + acento neon único, motivos de terminal.

---

## 3. ARQUITETURA & CONVENÇÕES DE FRONTEND

### 3.A Stack Padrão
* **Framework:** React / Next.js com Server Components (RSC).
  * **Interactivity Isolation:** Componentes com Motion, física ou listeners de scroll DEVEM ser folhas isoladas com `'use client'`.
* **Estilização:** Tailwind CSS (v4 preferido; v3 se projeto legado).
* **Animação:** `motion/react` (Motion / Framer Motion) para interações de UI; GSAP + ScrollTrigger para narrativas de scroll completas.
* **Ícones Permitidos:** `@phosphor-icons/react`, `hugeicons-react`, `@radix-ui/react-icons`, `@tabler/icons-react`. (Evitar `lucide-react` genérico por reflexo; padronizar `strokeWidth` globalmente em `1.5` ou `2.0`).
* **Emojis:** Proibidos por default em código e textos de UI. Use ícones SVG de bibliotecas reais.

### 3.B Layout & Viewport Stability
* **Altura de Viewport Segura:** NUNCA use `h-screen` para heros. SEMPRE use `min-h-[100dvh]` para evitar saltos de layout no mobile (barra de endereço do iOS Safari).
* **Grid sobre Cálculos Flex:** Use CSS Grid (`grid grid-cols-1 md:grid-cols-3 gap-6`) em vez de cálculos manuais de percentual flex (`w-[calc(33%-1rem)]`).
* **Largura Máxima:** Delimite containers com `max-w-7xl mx-auto` ou `max-w-[1400px]`.

---

## 4. DIRETRIZES DE ENGENHARIA DE DESIGN & CORREÇÃO DE VIESES

### 4.1 Tipografia
* **Headlines / Display:** `text-4xl md:text-6xl tracking-tighter leading-none`.
* **Corpo / Parágrafos:** `text-base text-gray-600 dark:text-gray-400 leading-relaxed max-w-[65ch]`.
* **Sans Font:** Evite `Inter` como padrão cego. Prefira `Geist`, `Outfit`, `Cabinet Grotesk`, `Satoshi`, `Plus Jakarta Sans`.
* **Disciplina de Serifas:** Serifa é RESTRITA a briefings genuinamente editoriais, luxo ou vintage.
  - Banimento específico como defaults: `Fraunces` e `Instrument_Serif` (favoritos de IA).
  - Quando justificada, rotacione fontes como *PP Editorial New, Tiempos Headline, Cormorant Garamond, Newsreader*.
* **Descendentes Itálicos:** Quando usar itálico com letras `y, g, j, p, q`, use `leading-[1.1]` e reserva `pb-1` para não cortar os traços.

### 4.2 Calibração de Cores & Lila Rule
* No máximo 1 cor de acento com saturação < 80%.
* **A Regra Lila:** Banido o reflexo automático de gradientes e botões roxos/azuis com glow. Use bases neutras (Zinc, Slate, Stone) com acentos singulares de alto contraste (Emerald, Electric Blue, Deep Rose, Burnt Orange).
* **Banimento da Paleta Padrão de IA:** Para produtos premium/artesanais, a IA sempre gera bege (#f5f1ea) + latão (#b08947) + espresso (#1a1714). Roteie para:
  - *Cold Luxury:* Cinza prata + cromo + fumaça.
  - *Forest:* Verde profundo + osso + âmbar.
  - *Black and Tan:* Off-black + tan quente com contraste nítido.
  - *Cobalt + Cream:* Azul saturado contra neutro único.
* **Color Consistency Lock:** O acento escolhido deve ser mantido de forma 100% consistente em toda a página.

### 4.3 Disciplina Rígida de Hero
* **O Hero DEVE caber na primeira viewport:** Headline em no máximo 2 linhas; subtexto com no máximo **20 palavras** e 3-4 linhas; CTAs visíveis sem rolagem.
* **Hero Top Padding Cap:** Máximo `pt-24` (≈6rem) no desktop para o conteúdo não flutuar no meio da tela.
* **Hero Stack Discipline:** No máximo 4 elementos no stack do Hero (1. Eyebrow OU Brand Strip; 2. Headline; 3. Subtexto; 4. CTAs). Logo wall de clientes/confiança pertence ABAIXO do Hero, nunca comprimido dentro dele.

### 4.4 Regras de Anti-Repetição de Seções
* **Variação de Layout de Seção:** Em uma página com 8 seções, use pelo menos 4 famílias de layout distintas. Nunca repita o mesmo layout em seções consecutivas.
* **Cap de Zigzag:** No máximo 2 seções consecutivas com divisão imagem+texto alternada. A 3ª consecutiva é proibida.
* **Restrição Mecânica de Eyebrows:** No máximo 1 eyebrow (rótulo pequeno em maiúsculas tracking largo) a cada 3 seções. Em uma página de 9 seções, use no máximo 3 eyebrows no total.
* **Ban de Split-Header:** Proibido o cabeçalho "título gigante na esquerda + parágrafo flutuando no canto superior direito". Se precisar de ambos, empilhe verticalmente (`max-w-[65ch]`).
* **Bento Diversity & Exact Count:** Grids Bento devem ter contagem exata de células (sem espaços vazios) e pelo menos 2 a 3 células com variação visual real (imagem, gradiente tonal, contraste), não apenas texto branco sobre branco.

### 4.5 Banimento Absoluto de Em-Dash (`—`)
* **Zero Em-Dashes:** O caractere `—` (travessão longo) e `–` (meia-risca) é expressamente proibido em headlines, eyebrows, botões, pills, body copy, citações e legendas. É a principal assinatura de texto gerado por IA. Use ponto final, vírgula, dois-pontos ou o hífen simples `-`.

---

## 5. SKELETONS CANÔNICOS DE MOTION & UI

### 5.A GSAP Sticky-Stack (Canonical Skeleton)
```tsx
"use client";
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";

gsap.registerPlugin(ScrollTrigger);

export function StickyStack({ cards }: { cards: React.ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || !ref.current) return;
    const ctx = gsap.context(() => {
      const cardEls = gsap.utils.toArray<HTMLElement>(".stack-card");
      cardEls.forEach((card, i) => {
        if (i === cardEls.length - 1) return;
        ScrollTrigger.create({
          trigger: card,
          start: "top top",
          endTrigger: cardEls[cardEls.length - 1],
          end: "top top",
          pin: true,
          pinSpacing: false,
        });
        gsap.to(card, {
          scale: 0.92,
          opacity: 0.55,
          ease: "none",
          scrollTrigger: {
            trigger: cardEls[i + 1],
            start: "top bottom",
            end: "top top",
            scrub: true,
          },
        });
      });
    }, ref);
    return () => ctx.revert();
  }, [reduce]);

  return (
    <div ref={ref} className="relative">
      {cards.map((card, i) => (
        <div key={i} className="stack-card sticky top-0 min-h-[100dvh] flex items-center justify-center">
          {card}
        </div>
      ))}
    </div>
  );
}
```

### 5.B GSAP Horizontal-Pan (Canonical Skeleton)
```tsx
"use client";
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";

gsap.registerPlugin(ScrollTrigger);

export function HorizontalPan({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || !wrap.current || !track.current) return;
    const ctx = gsap.context(() => {
      const distance = track.current!.scrollWidth - window.innerWidth;
      gsap.to(track.current, {
        x: -distance,
        ease: "none",
        scrollTrigger: {
          trigger: wrap.current,
          start: "top top",
          end: () => `+=${distance}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
    }, wrap);
    return () => ctx.revert();
  }, [reduce]);

  return (
    <section ref={wrap} className="relative overflow-hidden">
      <div ref={track} className="flex h-[100dvh] items-center">
        {children}
      </div>
    </section>
  );
}
```

### 5.C Apple Liquid Glass (Web Approximation)
```css
.liquid-glass-web-approx {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / .32);
  background: linear-gradient(135deg, rgb(255 255 255 / .30), rgb(255 255 255 / .08)), rgb(255 255 255 / .12);
  backdrop-filter: blur(24px) saturate(180%) contrast(1.05);
  -webkit-backdrop-filter: blur(24px) saturate(180%) contrast(1.05);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .48), inset 0 -1px 0 rgb(255 255 255 / .12), 0 18px 60px rgb(0 0 0 / .18);
}
```

---

## 6. PRE-FLIGHT CHECKLIST (Filtro Obrigatório de Entrega)

Antes de considerar qualquer entrega de frontend concluída, valide rigorosamente:
- [ ] **Design Read declarado** em uma linha antes do código?
- [ ] **Dials explicitados** e coerentes com o briefing?
- [ ] **ZERO em-dashes (`—` ou `–`)** em toda a interface?
- [ ] **Page Theme Lock:** um único tema consistente para a página toda?
- [ ] **Color & Shape Consistency Lock:** acento e escala de bordas unificados?
- [ ] **Button Contrast Check:** texto do CTA passa em WCAG AA (mínimo 4.5:1)?
- [ ] **CTA Button Wrap:** nenhum botão de CTA quebra em 2+ linhas no desktop?
- [ ] **Hero Viewport Fit:** headline ≤ 2 linhas, subtexto ≤ 20 palavras, CTA visível sem scroll?
- [ ] **Hero Top Padding Cap:** `pt-24` no máximo no desktop?
- [ ] **Eyebrow Count:** número total de eyebrows ≤ `ceil(total_secoes / 3)`?
- [ ] **Split-Header banido:** sem parágrafo flutuando no canto superior direito do header?
- [ ] **Zigzag Alternation Cap:** no máximo 2 seções consecutivas de imagem+texto?
- [ ] **Bento Diversity:** células com variação visual real e contagem exata de itens?
- [ ] **Imagens Reais / Geradas:** sem divs simulando falsos screenshots de produto?
- [ ] **Sem `window.addEventListener('scroll')`:** uso exclusivo de Motion/ScrollTrigger/IntersectionObserver?
- [ ] **Prefers-reduced-motion** respeitado em todas as animações?
- [ ] **Viewport Stability:** uso de `min-h-[100dvh]`, nunca `h-screen`?
