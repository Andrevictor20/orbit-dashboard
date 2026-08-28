---
name: redesign-ui-audit
description: "Auditoria e modernização cirúrgica de interfaces existentes. Identifica padrões genéricos de IA e fraquezas de UI, aplicando melhorias de alto impacto (tipografia, espaçamento, contraste, hierarquia, motion sutil) sem quebrar arquitetura de informação, SEO ou funcionalidades."
---

# Redesign UI Audit: Protocolo de Modernização de Interfaces

> **Propósito:** Elevar websites e apps existentes para um padrão visual premium sem quebrar o que já funciona. Funciona com qualquer stack (Tailwind, CSS Modules, Styled Components ou Vanilla CSS).

---

## 1. O Ciclo de Execução: Scan → Diagnose → Fix

1. **Scan (Mapeamento):** Ler a base de código, identificar framework, tokens e estrutura existente.
2. **Diagnose (Diagnóstico):** Rodar a auditoria visual abaixo listando fraquezas, inconsistências e padrões genéricos de IA.
3. **Fix (Correção Cirúrgica):** Aplicar melhorias graduais na stack atual. Não reescrever tudo do zero.

---

## 2. Checklist de Auditoria de Redesign

### Tipografia
- [ ] Substituir fontes padrão de navegador ou Inter genérico por opções com personalidade (`Geist`, `Cabinet Grotesk`, `Satoshi`, `Outfit`).
- [ ] Aplicar tracking negativo em títulos grandes (`tracking-tight`) e positivo em pequenos metadados.
- [ ] Limitar a largura do texto de parágrafos a aproximadamente `65ch` com `line-height` relaxado (`1.6`).
- [ ] Usar figuras tabulares (`font-variant-numeric: tabular-nums` / `font-mono`) em números e métricas.

### Cores e Superfícies
- [ ] Substituir fundos pretos puros `#000000` por carvão ou off-black matizado (`#0a0a0a`, `#121212`).
- [ ] Limitar saturação de acentos a < 80%.
- [ ] Remover gradientes roxos/azuis automáticos de IA em favor de bases neutras sólidas e acento único.
- [ ] Colorir sombras para acompanhar a matiz do fundo em vez de usar preto fosco desbotado.
- [ ] Evitar seções escuras avulsas jogadas no meio de uma página clara sem transição intencional.

### Layout e Alinhamento
- [ ] Substituir fileiras de 3 cards idênticos por layouts assimétricos (bento grid, 2 colunas zig-zag ou carrossel).
- [ ] Substituir `100vh` por `min-h-[100dvh]` para evitar saltos no mobile (iOS Safari).
- [ ] Travar containers com `max-w-7xl mx-auto`.
- [ ] Garantir que botões de CTA fiquem perfeitamente alinhados na base de colunas ou cartões com alturas de texto variadas (`mt-auto`).

### Interatividade e Estados
- [ ] Adicionar feedback tátil no clique (`active:scale-[0.98]` ou `active:translate-y-[1px]`).
- [ ] Garantir anéis de foco visíveis (`focus-visible:ring-2`) para navegação por teclado (WCAG AA).
- [ ] Substituir spinners genéricos por skeletal loaders que espelham o formato final do layout.
- [ ] Adicionar transições suaves (200-300ms) em todos os elementos interativos.

---

## 3. Ordem de Prioridade de Correção (Máximo Impacto com Mínimo Risco)

1. **Troca Tipográfica** (Maior salto estético instantâneo com menor risco de quebra).
2. **Limpeza da Paleta de Cores** (Desaturação e unificação de tons neutros).
3. **Estados de Hover e Ativo** (Traz dinamismo e vida imediata à interface).
4. **Espaçamento e Grid** (Ajuste de padding vertical e limites de container).
5. **Substituição de Componentes Genéricos** (Bento grids e seções assimétricas).
6. **Polimento de Estados de Vazio, Erro e Carregamento**.
