---
name: living-docs-keeper
description: Manutenção de um documento vivo de projeto (estilo CLAUDE.md/AGENTS.md) que qualquer agente lê no início de cada sessão — arquitetura, stack, hurdles conhecidos com solução, padrões de design e checklist do projeto. Use esta skill sempre que um agente descobrir algo novo e não-óbvio durante o desenvolvimento (uma dificuldade de API externa, uma decisão de arquitetura, um padrão que deve ser seguido daqui pra frente), sempre que iniciar trabalho em um projeto que já tem esse documento (leia-o primeiro), e sempre que o usuário pedir para "documentar" uma decisão ou "atualizar o contexto do projeto". Ative com prioridade alta sempre que um problema difícil for resolvido — a informação deve ser registrada antes que a sessão termine, ou ela se perde.
---

# Living Docs Keeper

## Papel desta skill

Manter um único documento vivo por projeto (nome sugerido: `AGENTS.md`, `CLAUDE.md`, ou equivalente na convenção da ferramenta) que funciona como onboarding permanente para qualquer agente — principal ou subagente — que trabalhe no projeto depois. A diferença para documentação tradicional: este documento é lido **integralmente, no início de cada tarefa**, por um "novo membro de equipe" (o agente) que não tem memória entre sessões — então cada informação registrada ali paga dividendo toda vez que alguém (humano ou agente) volta ao projeto.

## O que o documento deve cobrir

1. **Visão geral da arquitetura** — componentes principais e como se comunicam.
2. **Stack tecnológico completo** — linguagens, frameworks, serviços externos.
3. **Variáveis de ambiente / configuração** necessárias para rodar o projeto.
4. **Estrutura de diretórios** e onde encontrar cada tipo de coisa (serviços, jobs, models, testes).
5. **Hurdles conhecidos com solução documentada** — toda dificuldade não-óbvia já enfrentada (ex.: "API X bloqueia clients não-browser, use headless browser com stealth", "LLM Y inventa números quando não tem dado real, sempre buscar dado real primeiro"). Esta é a seção de maior retorno.
6. **Padrões/decisões de design do projeto** — convenções que devem ser seguidas em código novo.
7. **Pipelines/processos recorrentes**, se houver (jobs agendados, deploys, rotinas).
8. **Checklist pós-implementação** — passos que sempre devem ser feitos antes de considerar algo pronto (rodar CI, atualizar changelog, etc.).

## Quando atualizar (gatilho imediato, não adiado)

Atualize o documento **no mesmo ciclo de trabalho** em que a informação surgir, não "quando sobrar tempo":
- Um hurdle inesperado foi resolvido (algo que não estava documentado em nenhum lugar e custou tempo de investigação).
- Uma decisão de arquitetura foi tomada em conjunto com o humano (ver skill `pair-navigator`) — registre a decisão e o porquê, não só o resultado.
- Um padrão novo de código foi estabelecido e deve ser seguido daqui pra frente.
- Um falso positivo de segurança foi identificado e justificado (ver skill `ci-security-gate`) — documente por que é seguro, para não virar dúvida recorrente.

## Como escrever cada entrada

- Seja específico e acionável, não narrativo. Prefira "Yahoo Finance bloqueia HTTP clients por TLS fingerprinting → usar headless Chromium com crumb authentication" a um parágrafo contando a história da descoberta.
- Hurdles devem ter formato problema → solução, fácil de escanear.
- Não deixe o documento crescer sem estrutura — use seções e, se ficar muito longo, hierarquize com um sumário no topo.

## Ao iniciar trabalho em um projeto existente

Antes de propor qualquer mudança, **leia o documento vivo do projeto inteiro primeiro**, se ele existir. Trate seu conteúdo como contexto autoritativo — não redescubra um hurdle já documentado, e não contradiga um padrão de design já estabelecido sem justificativa explícita.

## Checklist

- [ ] Alguma informação nova e não-óbvia surgiu nesta tarefa que merece entrar no documento?
- [ ] A entrada está no formato problema → solução, fácil de escanear por outro agente depois?
- [ ] O documento foi lido por completo antes de iniciar a tarefa (se já existia)?
- [ ] Decisões de arquitetura tomadas em conjunto foram registradas com o porquê, não só o quê?
