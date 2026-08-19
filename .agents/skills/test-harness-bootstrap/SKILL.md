---
name: test-harness-bootstrap
description: Configuração do harness de testes no momento zero de um projeto — framework de teste instalado e configurado, estrutura de pastas de teste, step de teste rodando no CI, e um teste trivial passando antes de qualquer feature real ser escrita. Use esta skill sempre que um projeto novo estiver sendo criado a partir de um prompt inicial (scaffold), sempre que um projeto existente não tiver nenhum framework de teste configurado ainda, e sempre antes de aceitar a primeira feature real em um projeto recém-criado. Ative com prioridade máxima no primeiro commit de qualquer projeto novo — sem isso, toda a disciplina de TDD do restante do fluxo não tem onde rodar.
---

# Test Harness Bootstrap

Esta skill resolve um problema específico: TDD só funciona se o harness de teste já existir. Ela roda **uma vez, no início do projeto** (ou na primeira vez que alguém percebe que o projeto não tem harness de teste nenhum) — não em cada tarefa.

## O que "harness pronto" significa, na prática

Antes de considerar o bootstrap concluído, confirme que existem:

1. **Framework de teste instalado e configurado** para a stack escolhida (ex.: Minitest/RSpec para Ruby, pytest para Python, Jest/Vitest para JS/TS, go test para Go).
2. **Estrutura de pastas de teste** espelhando a estrutura de código (ex.: `test/` ou `spec/` com subpastas correspondentes a `app/`, `src/`, etc.).
3. **Comando único** para rodar a suíte completa localmente (ex.: `bin/rails test`, `pytest`, `npm test`) — documentado no README ou na documentação viva do projeto.
4. **Step de teste no pipeline de CI**, rodando automaticamente a cada commit (coordenar com a skill `ci-security-gate` para o pipeline completo — lint, segurança, testes).
5. **Um teste trivial já passando** (ex.: um teste de smoke que só confirma que a aplicação sobe, ou um teste do primeiro model/rota criado no scaffold) — isso prova que o harness realmente funciona de ponta a ponta, não só que os arquivos de config existem.
6. **Runner configurado para rodar em paralelo**, se a stack suportar e o projeto tender a crescer — evita que a suíte fique lenta demais conforme o projeto cresce, o que historicamente é o que leva times a pular testes sob pressão de tempo.

## Quando esta skill é acionada

- **Projeto novo do zero**: acontece como parte da resposta ao primeiro prompt de criação, antes do primeiro "Add ..." de feature real. Deve ser, em si, um commit isolado (ex.: `Add test harness scaffold`), passando pelo `release-gatekeeper` como qualquer outro.
- **Projeto existente sem harness**: se, ao iniciar trabalho em um projeto já existente, você perceber que não há nenhum framework de teste configurado, pare e proponha rodar esta skill antes de aceitar a primeira feature — não escreva código de produção novo sobre uma base sem rede de segurança.

## O que NÃO fazer

- Não escreva testes de feature específicos nesta etapa — isso é trabalho do `test-guardian` em cada tarefa subsequente. O bootstrap só garante que a infraestrutura de teste existe e funciona.
- Não pule a validação do "teste trivial passando" — um harness configurado mas nunca executado com sucesso é uma falsa sensação de segurança.
- Não deixe o step de teste no CI como manual/opcional "para configurar depois" — se não roda automaticamente a cada commit, não conta como pronto.

## Checklist de saída (bootstrap concluído)

- [ ] Framework de teste instalado e configurado para a stack
- [ ] Estrutura de pastas de teste criada, espelhando o código
- [ ] Comando único para rodar a suíte, documentado
- [ ] Step de teste automatizado no CI, rodando a cada commit
- [ ] Pelo menos um teste real passando (não um placeholder vazio)
- [ ] Commit isolado (`Add test harness scaffold`) validado pelo `release-gatekeeper`
