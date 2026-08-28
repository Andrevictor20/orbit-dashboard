---
name: observability-instrumentation
description: Instrumentação de observabilidade em produção — logging estruturado, métricas essenciais (latência, taxa de erro, saturação), captura de exceções, e uma janela de monitoramento ativo logo após cada deploy. Use esta skill sempre que implementar uma operação crítica (endpoint público, job assíncrono, integração externa, fluxo de pagamento/autenticação) para decidir o que logar/medir, e sempre depois de um deploy em produção para saber o que observar nos minutos seguintes. Não confundir com ci-security-gate/deploy-pipeline-conductor: aquelas validam que o código está correto e que o deploy funcionou (health check binário, sim/não); esta skill cuida de saber o que está acontecendo de verdade em produção ao longo do tempo, inclusive quando o health check passa mas algo já está degradando.
---

# Observability Instrumentation

Health check pós-deploy (skill `deploy-pipeline-conductor`) responde "a aplicação subiu?". Esta skill responde a pergunta seguinte, mais importante: "o que está acontecendo com ela agora, e eu vou saber se algo piorar?".

## O que instrumentar por padrão, ao implementar

Nem toda linha de código precisa de log ou métrica — instrumentação em excesso é tão ruim quanto ausência dela (ruído esconde sinal). Instrumente deliberadamente:

**Logging estruturado (não texto livre)**
- Use um formato estruturado (JSON ou equivalente da stack) em vez de `print`/`console.log` de texto solto — logs estruturados são pesquisáveis e correlacionáveis depois.
- Todo log de erro inclui contexto suficiente para investigar sem precisar reproduzir: identificador da requisição/transação, o que estava sendo feito, e a mensagem de erro real (não só "algo deu errado").
- **Nunca logar dado sensível** (senha, token, número de cartão, dado pessoal completo) — isso é extensão direta da skill `security-sentinel-review`. Quando precisar referenciar o registro, use um identificador, não o dado em si.
- Nível de log é intencional: erro para o que precisa de atenção humana, warning para degradação tolerável, info para eventos de negócio relevantes (não para cada linha executada).

**Métricas essenciais (método RED para serviços request-driven)**
- **Rate** — quantas requisições/operações por período.
- **Errors** — taxa de erro, não só contagem absoluta.
- **Duration** — latência (idealmente p50/p95/p99, não só média — média esconde os piores casos).
- Para processos assíncronos/filas, adicione: tamanho da fila e idade do item mais antigo pendente (fila crescendo é sinal de degradação antes de virar incidente).

**Captura de exceções**
- Exceções não tratadas em produção devem ser capturadas com stack trace completo e contexto, não apenas causar um log de erro genérico e seguir adiante silenciosamente.
- Erros esperados (validação, entrada inválida do usuário) não são a mesma coisa que exceções — não polua o canal de erro real com ruído de validação normal do domínio.

## Janela de monitoramento pós-deploy

O health check do `deploy-pipeline-conductor` é um sinal binário no momento do deploy — não garante que nada vai degradar minutos depois. Ao finalizar um deploy em produção:
1. Acompanhe ativamente taxa de erro e latência por uma janela curta após o deploy (minutos, não segundos) antes de considerar o deploy "estável" — não apenas "no ar".
2. Se a taxa de erro ou latência subir de forma anormal nessa janela, trate como sinal de rollback, mesmo que o health check inicial tenha passado.
3. Se o projeto ainda não tem onde ver essas métricas (nenhum dashboard/ferramenta configurada), sinalize isso como lacuna antes de aprovar o primeiro deploy real de produção — observabilidade não pode ser a primeira coisa configurada depois que já deu problema.

## Alertas

- Defina limiares de alerta com base em impacto real ao usuário (ex. taxa de erro acima de X%, latência p95 acima de Y), não em números arbitrários copiados de outro projeto.
- Evite alertas que disparam com frequência e são ignorados por rotina ("alert fatigue") — um alerta que ninguém mais lê é pior que nenhum alerta, porque cria falsa sensação de cobertura.
- Alertas críticos (indisponibilidade, erro em fluxo de pagamento/autenticação) devem notificar de forma que não dependa de alguém estar olhando um dashboard por acaso.

## Onde isso se encaixa no kit

- Ao implementar (`builder`), instrumente operações críticas seguindo os padrões acima como parte da própria tarefa — não como algo adicionado depois que já virou incidente.
- Ao validar o commit (`release-gatekeeper`), considere se a mudança introduziu uma operação crítica nova sem instrumentação correspondente — isso é análogo a "código sem teste": aceitável às vezes, mas deve ser uma decisão explícita, não um esquecimento.
- Ao fazer deploy (`shipper`), aplique a janela de monitoramento pós-deploy descrita acima antes de considerar a tarefa encerrada.
- Se um incidente acontecer e for investigado, registre a causa raiz e o que foi instrumentado/alertado como consequência via `living-docs-keeper` — isso é exatamente o tipo de hurdle que vale documentar para não se repetir.

## Quando esta skill pode ser dispensada

Projetos pessoais/protótipos sem usuário real em produção não precisam do rigor completo — mas assim que houver tráfego real (mesmo pequeno) valendo dinheiro, reputação, ou dado de terceiros, os itens de logging estruturado e captura de exceções deixam de ser opcionais.
