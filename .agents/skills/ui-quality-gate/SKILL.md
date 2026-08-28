---
name: ui-quality-gate
description: Gate de qualidade de interface aplicado depois que uma UI é implementada — acessibilidade (contraste WCAG AA, foco de teclado, semântica), responsividade real (min-h-[100dvh], single-line nav), respeito a prefers-reduced-motion, ban de quebra de CTA e autocrítica anti-slop antes do release. Complementa as skills de direção estética.
---

# UI Quality Gate

A direção estética e a qualidade de produção caminham juntas. Esta skill garante que o código final implementado é robusto, acessível, responsivo e livre de defeitos de layout e clichês de IA.

---

## Checklist de Validação Obrigatório (Pré-Commit / Pré-Release)

### 1. Acessibilidade & Contraste (WCAG AA)
- [ ] **Contraste de Texto:** Atende no mínimo 4.5:1 para texto normal e 3:1 para texto grande.
- [ ] **Contraste de Botões:** O texto de todos os CTAs é legível contra o fundo (proibido botão branco com texto branco ou botão transparente sem borda).
- [ ] **Contraste de Formulários:** Inputs, placeholders, helper texts e estados de foco passam em 4.5:1 contra o fundo da seção.
- [ ] **Foco de Teclado:** Todo elemento interativo possui anel de foco visível (`focus-visible:ring-2`).
- [ ] **Semântica HTML:** Uso de `<button>`, `<a>`, `<nav>`, `<main>`, `<section>` em vez de divs genéricas com `onClick`.

### 2. Responsividade & Estabilidade de Viewport
- [ ] **Viewport Stability:** Uso estrito de `min-h-[100dvh]` para heros e seções cheias (NUNCA usar `h-screen`, que causa saltos no iOS Safari).
- [ ] **Navegação em Uma Linha:** Barra de navegação cabe em uma única linha no desktop, com altura máxima de `80px`.
- [ ] **CTA Button Wrap Ban:** O texto dos botões principais de CTA cabe em uma única linha no desktop (sem quebra feia de linha).
- [ ] **Colapso Mobile Explícito:** Layouts assimétricos colapsam com segurança para `grid-cols-1 w-full px-4` em telas `< 768px`.

### 3. Movimento, Performance & Preferências
- [ ] **Prefers-Reduced-Motion:** Animações e físicas colapsam para transições estáticas/instantâneas sob `prefers-reduced-motion`.
- [ ] **Sem Listeners no Window:** Proibido `window.addEventListener('scroll')`. Uso exclusivo de Motion, ScrollTrigger ou IntersectionObserver.
- [ ] **GPU-Safe:** Transições animam apenas `transform` e `opacity`.

### 4. Filtro Anti-Slop (Livre de Clichês de IA)
- [ ] **Zero Em-Dashes (`—`):** Nenhum travessão longo ou meia-risca em headlines, botões, pills, body copy ou legendas.
- [ ] **Imagens Reais / Geradas:** Ausência de falsos screenshots desenhados com divs (`<div>` simulando tela de app).
- [ ] **Hero Despoluído:** Headline com no máximo 2 linhas, subtexto com no máximo 20 palavras e CTA visível sem rolagem.
- [ ] **Page Theme Lock:** A página mantém um único tema consistente do topo ao rodapé, sem inversões aleatórias no meio do scroll.
