---
name: component-architecture
description: "Design e arquitetura de componentes de UI de alta fidelidade. Padrões Double-Bezel (Doppelrand), Button-in-Button, Bento Diversity, estados completos (Loading/Empty/Error) e alternativas avançadas para listas longas."
---

# Component Architecture

Regras e padrões de engenharia para componentes de UI robustos e esteticamente refinados:

---

## 1. Padrões Estruturais Avançados

### 1.A The "Double-Bezel" (Doppelrand / Chassi Usinado)
- Envolva componentes e cartões principais em uma estrutura de duas camadas:
  - **Casca Externa:** `bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 p-2 rounded-[2rem]`.
  - **Núcleo Interno:** `bg-white dark:bg-zinc-900 rounded-[calc(2rem-8px)] p-6 shadow-sm`.

### 1.B Nested CTA & "Button-in-Button"
- Botões primários em pílula com o ícone de ação (`↗`) aninhado em seu próprio círculo interno (`w-8 h-8 rounded-full bg-black/10 flex items-center justify-center`).
- Micro-interação no hover deslocando a seta na diagonal e aplicando `active:scale-[0.98]` no clique.

### 1.C Bento Grid com Contagem Exata & Diversidade Visual
- Uma grade Bento deve ter exatamente o número de células do conteúdo disponível ($N$ itens $\rightarrow N$ células). Sem buracos ou células vazias no final.
- Pelo menos 2 a 3 células devem ter variação visual real (imagem, gradiente tonal suave, destaque de contraste), não apenas texto branco idêntico em todas.

---

## 2. Tratamento para Listas Longas (> 5 Itens)

Evite o padrão preguiçoso de uma lista simples `<ul>` com linhas de borda em cada item. Para conjuntos com mais de 5 itens, use:
1. **Grid de Cartões em 2 Colunas** com valor em display grande e legenda explicativa.
2. **Abas / Accordion** com filtros por categoria.
3. **Pílulas de Rolagem Horizontal com Scroll-Snap**.
4. **Carrossel** para avaliações, logos ou destaques.

---

## 3. Ciclo Completo de Estados de UI

Todo componente interativo deve prever e implementar:
- **Default State:** Visual polido e hierarquia clara.
- **Hover & Focus State:** Realce visual suave e anel de foco acessível (`focus-visible:ring-2`).
- **Active / Pressed State:** Simulação de clique tátil (`active:scale-[0.98]`).
- **Loading State:** Skeleton loader espelhando o formato final (sem spinners circulares genéricos).
- **Empty State:** Visual composto com ilustração/ícone e CTA de ação.
- **Error State:** Mensagem de erro contextual e amigável.
