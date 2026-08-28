---
name: frontend-performance
description: "Auditoria de desempenho no Frontend, Core Web Vitals (LCP, INP, CLS), renderização GPU-safe, isolamento de interatividade em client components e governança de DOM e camadas."
---

# Frontend Performance & Core Web Vitals

Diretrizes de performance para manter 60+ FPS constante, tempo de carregamento instantâneo e pontuação máxima no Lighthouse:

---

## 1. Aceleração de Hardware & GPU-Safe Animations
- **Animações Fluidas:** Anime **apenas** `transform` e `opacity`. NUNCA anime `top`, `left`, `width` ou `height` (que causam reflow e repintura contínua de layout).
- **Uso Restrito de `will-change: transform`:** Apenas em elementos com animações ativas e frequentes.

---

## 2. Custos de DOM, Blur & Ruído
- **Backdrop-Blur Restrito:** Aplique filtros `backdrop-filter: blur(...)` EXCLUSIVAMENTE em elementos fixos ou flutuantes (navbars, overlays). NUNCA aplique blur em containers com rolagem contínua (destrói o FPS no mobile).
- **Texturas de Ruído / Grain:** Aplique filtros de grain sempre em um pseudo-elemento ou camada fixa com `pointer-events-none` (`fixed inset-0 z-50 pointer-events-none`).
- **Z-Index Restraint:** Não use valores mágicos arbitrários como `z-[9999]`. Utilize uma escala sistemática controlada (nav: 40, modal: 50, grain: 60).

---

## 3. Gestão de Eventos de Rolagem & Estado
- **Banimento de Listeners de Scroll Brutos:** É PROIBIDO usar `window.addEventListener('scroll', ...)`. Utilize `useScroll()` do Motion, `ScrollTrigger` do GSAP ou `IntersectionObserver`.
- **Sem Atualização de React State Contínua:** Nunca atualize `useState` a cada frame de rolagem ou movimento de mouse. Use `useMotionValue` e `useTransform` do Motion fora do ciclo de renderização do React.

---

## 4. Metas de Core Web Vitals
- **LCP (Largest Contentful Paint) < 2.5s:** Imagem do Hero otimizada com prioridade de carregamento (`priority` no Next/Image).
- **INP (Interaction to Next Paint) < 200ms:** Processamento pesado fora da thread principal.
- **CLS (Cumulative Layout Shift) < 0.1:** Espaço reservado para imagens, fontes e embeds dinâmicos.
