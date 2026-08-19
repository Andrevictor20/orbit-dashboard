---
name: ui-quality-gate
description: Gate de qualidade de interface aplicado depois que uma UI é implementada — acessibilidade (contraste, foco de teclado, semântica), responsividade (mobile a desktop), respeito a prefers-reduced-motion, e autocrítica visual antes de considerar a feature pronta. Complementa a skill de direção estética (frontend-design): aquela decide a direção visual, esta valida se a implementação está de fato pronta para produção. Use sempre que uma feature envolver componente de UI novo ou alterado, antes de passar para o refactor-warden/release-gatekeeper.
---

# UI Quality Gate

Direção estética (paleta, tipografia, personalidade visual — coberta pela skill `frontend-design`) e qualidade de produção são preocupações diferentes. Um design pode ser visualmente distinto e ainda assim quebrar no mobile, ser inacessível de teclado, ou ignorar preferência de movimento reduzido. Esta skill garante a segunda parte.

## Checklist de validação (rodar após a implementação, antes do commit)

**Acessibilidade**
- Contraste de texto atende no mínimo AA (4.5:1 para texto normal, 3:1 para texto grande) — validar, não estimar visualmente.
- Todo elemento interativo (botão, link, campo) é alcançável e operável só de teclado, com estado de foco visível.
- Marcação semântica correta (`button` para ação, `a` para navegação, labels associados a inputs) — não usar `div` com `onClick` para algo que é, na prática, um botão.
- Imagens informativas têm texto alternativo; imagens puramente decorativas são marcadas como tais.

**Responsividade**
- Layout testado (ou revisado via screenshot, quando o ambiente permitir) em pelo menos três larguras: mobile estreito, tablet, desktop.
- Nenhum elemento crítico (ação principal, conteúdo essencial) depende de hover-only em contexto que também precisa funcionar em touch.
- Texto e espaçamento escalam sem quebrar layout ou criar overflow horizontal indesejado.

**Movimento e preferências do usuário**
- Animações respeitam `prefers-reduced-motion` — a interface continua funcional e compreensível com movimento reduzido/desativado.
- Nenhuma animação bloqueia a leitura do conteúdo ou a ação do usuário (ex. auto-scroll ou auto-avanço sem controle de pausa).

**Autocrítica visual antes de finalizar**
- Se o ambiente permitir capturar screenshot da UI implementada, faça isso e compare contra o plano de design aprovado — divergências (espaçamento, alinhamento, hierarquia visual) devem ser corrigidas antes do commit, não deixadas para depois.
- Pergunta de calibração: esta tela, isolada, poderia ser confundida com o template padrão de qualquer outro projeto gerado por IA? Se sim, isso é um sinal de que a direção da skill `frontend-design` não foi seguida até o fim na implementação — não é motivo para refazer a direção, é motivo para revisar se o código realmente aplicou o plano aprovado.

## Quando esta skill NÃO se aplica

- Mudanças que não tocam em UI renderizada (lógica de backend pura, scripts, configuração) não precisam passar por este gate.
- Protótipos/spikes exploratórios explicitamente descartáveis (ver skill `pair-navigator`) podem pular esta validação, mas devem passar por ela antes de qualquer versão que vá para produção.

## Ao encontrar um problema

Trate achados de acessibilidade como bloqueantes (mesmo padrão de severidade da skill `security-sentinel-review`: não é "nice to have", é requisito de produção) — corrija antes de liberar para `refactor-warden`/`release-gatekeeper`. Achados menores de polimento visual podem ser registrados como dívida aceita via `living-docs-keeper`, desde que explicitamente decidido, não esquecido.
