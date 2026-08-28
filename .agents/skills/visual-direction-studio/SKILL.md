---
name: visual-direction-studio
description: Direção estética intencional e distintiva ao criar ou redesenhar uma UI — calibração de dials (VARIANCE, MOTION, DENSITY), paleta, tipografia e layout deliberados, eliminando totalmente o "look padrão de IA", em-dashes excessivos e layouts repetitivos. Use esta skill sempre que uma tela, componente ou página nova for projetada, antes de qualquer código de UI ser escrito.
---

# Visual Direction Studio (Anti-Slop Art Direction)

Assuma a postura de diretor de design de um pequeno estúdio de elite conhecido por criar identidades digitais únicas e inconfundíveis ($150k+ Tier). Rejeite ativamente templates e clichês de IA.

---

## 1. Passo 0: Brief Inference & Os Três Dials

Antes de tocar no código ou nos estilos, faça o **Design Read** e calibre os 3 dials:
- **`DESIGN_VARIANCE` (1-10):** Nível de experimentação assimétrica (7-9 para marketing/criativo, 4-6 para SaaS/editorial, 3 para governamental/alta acessibilidade).
- **`MOTION_INTENSITY` (1-10):** Intensidade de movimento e interatividade (6-8 para landing pages, 3-4 para interfaces focadas em produtividade).
- **`VISUAL_DENSITY` (1-10):** Densidade de informação (3-4 para marketing espaçoso, 7-8 para dashboards/cockpits).

---

## 2. Disciplina Rígida de Hero

- **O Hero DEVE caber na viewport inicial:** Headline com no máximo 2 linhas no desktop; subtexto com no máximo **20 palavras** e 3-4 linhas; CTAs visíveis sem rolagem.
- **Top Padding Cap:** Padding superior do Hero no máximo `pt-24` (≈6rem) no desktop para o conteúdo não afundar no meio da tela.
- **Hero Stack Discipline (Máximo 4 elementos de texto):**
  1. Eyebrow OU Brand Strip (escolha zero ou um);
  2. Headline principal;
  3. Subtexto conciso (≤ 20 palavras);
  4. CTAs (1 primário + no máximo 1 secundário).
- **Logo Wall Sob o Hero:** Logos de clientes/confiança ficam em uma seção dedicada diretamente ABAIXO do Hero, nunca espremidos dentro dele.

---

## 3. Regras de Anti-Repetição de Seções

- **Variação de Famílias de Layout:** Em uma página com 8 seções, use pelo menos 4 famílias de layout diferentes (ex: split assimétrico, bento grid, citação editorial, carrossel de cartões).
- **Cap de Zigzag:** No máximo 2 seções consecutivas no formato "imagem na esquerda + texto na direita". A 3ª consecutiva é expressamente proibida.
- **Restrição Mecânica de Eyebrows:** No máximo 1 eyebrow (rótulo pequeno em caixa alta) a cada 3 seções. Em uma página de 9 seções, use no máximo 3 eyebrows no total.
- **Banimento de Split-Header:** Proibido o padrão de cabeçalho com título grande na esquerda e parágrafo flutuando no canto superior direito. Use empilhamento vertical com `max-w-[65ch]`.

---

## 4. Banimento Absoluto de Em-Dash (`—`)

- O caractere `—` (travessão longo) e `–` (meia-risca) é estritamente proibido em headlines, eyebrows, botões, pills, body copy, citações e legendas. Use ponto final, vírgula, dois-pontos ou o hífen comum `-`.

---

## 5. Tipografia & Cores

- **Tipografia com Personalidade:** Evite usar `Inter` como padrão cego. Prefira `Geist`, `Cabinet Grotesk`, `Satoshi`, `Outfit`, `Plus Jakarta Sans`. Serifa é restrita a contextos genuinamente editoriais ou de luxo (rotacione fontes, evitando `Fraunces` e `Instrument_Serif` por padrão).
- **A Regra Lila:** Banido o reflexo automático de gradientes e botões roxos/azuis com glow. Use bases neutras (Zinc, Slate, Stone) com acentos singulares de alto contraste (Emerald, Electric Blue, Deep Rose, Burnt Orange).
- **Banimento da Paleta Padrão de IA:** Para produtos premium/artesanais, evite o clichê bege (#f5f1ea) + latão (#b08947) + espresso (#1a1714). Roteie para alternativas como *Cold Luxury, Forest, Black and Tan, Cobalt + Cream*.
- **Color Consistency Lock:** O acento escolhido deve ser mantido de forma 100% consistente em toda a página.

---

## 6. Processo em Duas Passadas

1. **Passada 1 — Plano de Design:** Defina os Dials, a paleta (valores hex e papéis), tipografia de destaque/corpo, conceito estrutural e o elemento-assinatura único da página.
2. **Passada 2 — Crítica Anti-Slop:** Revise contra os clichês de IA antes de codificar. Valide que o design resolve o problema real do usuário com distinção e refinamento.
