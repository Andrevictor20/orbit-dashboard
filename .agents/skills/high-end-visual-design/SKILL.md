---
name: high-end-visual-design
description: "Diretiva de design visual de alta costura para experiências digitais de nível agência Awwwards ($150k+ Tier). Arquitetura Double-Bezel (Doppelrand com raios concêntricos calculados matematicamente), botões ilha com trailing icon aninhado (Button-in-Button), física de mola com curvas cubic-bezier proprietárias, macro-padding e micro-interações táteis."
---

# High-End Visual Design & Motion Choreography (Awwwards-Tier)

> **Propósito:** Criar interfaces digitais com profundidade tátil, ritmo espacial refinado, acabamento de hardware usinado e micro-interações fluidas de alto padrão.

---

## 1. Arquitetura de Componentes de Alta Precisão

### 1.A The "Double-Bezel" (Doppelrand / Molduras Concêntricas)
Nunca coloque um card ou imagem flutuando com borda genérica cinza. Construa um chassi usinado:
- **Outer Shell (Casca Externa):** Wrapper `div` com fundo sutil (`bg-black/5` ou `bg-white/5`), linha ultrafina de borda (`ring-1 ring-black/5` ou `border border-white/10`), padding específico (ex: `p-2`) e raio externo generoso (`rounded-[2rem]`).
- **Inner Core (Núcleo Interno):** Container de conteúdo com fundo próprio, realce interno (`shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]`) e raio matematicamente menor calculado para manter concentricidade: `rounded-[calc(2rem-0.5rem)]`.

### 1.B Nested CTA & "Button-in-Button" Trailing Icon
- Botões interativos em formato de pílula sólida (`rounded-full px-6 py-3`).
- **Ícone Aninhado:** O ícone de seta (`↗`) NUNCA fica solto no texto; fica aninhado em seu próprio círculo interno (`w-8 h-8 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center`), alinhado com o padding direito do botão.
- No hover, o botão escala fisicamente no clique (`active:scale-[0.98]`) e o círculo com a seta se desloca sutilmente na diagonal (`group-hover:translate-x-1 group-hover:-translate-y-[1px]`).

---

## 2. Ritmo Espacial & Macro-Whitespace

- **Padding de Seção Dobrado:** Seções respiram com `py-24` a `py-40`.
- **Eyebrow Tags:** Rótulos pequenos em pílula (`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium`).
- **Contenção e Grid:** Layouts assimétricos (ex: `col-span-8` ao lado de dois cards `col-span-4`), caindo com segurança para `grid-cols-1 w-full px-4` em viewports menores que `768px`.

---

## 3. Coreografia de Movimento (Dinâmica de Fluidos e Mola)

- **Curvas Customizadas:** Nunca use transições padrão `linear` ou `ease-in-out`. Use curvas com inércia:
  ```css
  transition: all 0.7s cubic-bezier(0.32, 0.72, 0, 1);
  ```
- **Entrada em Rolagem:** Fade-up suave com desfoque progressivo (`translate-y-12 blur-sm opacity-0` para `translate-y-0 blur-0 opacity-100` sobre `700ms`).
- **Navegação em Ilha Flutuante:** Navbar destacada do topo da página como uma pílula de vidro flutuante (`mt-6 mx-auto w-max rounded-full backdrop-blur-xl`).

---

## 4. Salvaguardas de Performance

- **Aceleração GPU Estrita:** Anime exclusivamente `transform` e `opacity`.
- **Restrição de Backdrop Blur:** Aplique `backdrop-blur` apenas em elementos fixos ou sticky (navbars, overlays). NUNCA em containers de rolagem contínua.
- **Camada de Grão/Ruído Fixa:** Noise texturas sempre em camada fixa `pointer-events-none` (`fixed inset-0 z-50 pointer-events-none`).
