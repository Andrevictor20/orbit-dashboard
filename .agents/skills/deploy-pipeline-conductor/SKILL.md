---
name: deploy-pipeline-conductor
description: Condução do pipeline de deploy contínuo (CD) — build de artefato, promoção entre ambientes (staging/produção), estratégia de rollback, health checks pós-deploy, gestão de variáveis de ambiente/secrets por ambiente, e feature flags para desacoplar deploy de release. Inclui workflow de referência em GitHub Actions com Docker (assets/cd.yml, Dockerfile, docker-compose.dev.yml). Use esta skill sempre que uma mudança já aprovada pelo release-gatekeeper precisar ir para staging ou produção, sempre que configurar ou revisar a esteira de deploy de um projeto (incluindo GitHub Actions e Docker), e sempre que decidir como uma feature arriscada deve ser lançada (rollout gradual, flag, canary). Não confundir com ci-security-gate: aquela skill valida o commit (lint/segurança estática/testes); esta skill cuida do que acontece depois que o commit já está aprovado, até estar rodando de verdade em produção.
---

# Deploy Pipeline Conductor

Esta skill cobre a parte do processo que normalmente é esquecida em projetos "vibe coded": ter o software rodando em produção de forma repetível e reversível, não só "funcionando na minha máquina" ou aprovado no CI.

## Pipeline mínimo de deploy

1. **Build do artefato** — a partir do commit já aprovado pelo `release-gatekeeper`, gerar o artefato de deploy (imagem de container, build estático, pacote) de forma reprodutível e versionada.
2. **Promoção por ambiente** — staging (ou equivalente) antes de produção sempre que o projeto tiver esse ambiente disponível. Nunca pule staging só porque "a mudança é pequena".
3. **Health check pós-deploy** — após o deploy, validar automaticamente que a aplicação está respondendo corretamente (endpoint de health, smoke test básico) antes de considerar o deploy bem-sucedido.
4. **Estratégia de rollback definida** — todo deploy deve ter um caminho de volta claro (reverter para a versão anterior do artefato, ou reverter o commit e rodar o pipeline de novo). Se o rollback depende de passos manuais complexos, isso é uma lacuna a reportar, não a aceitar como normal.
5. **Tempo de deploy conhecido** — deploys devem ser rápidos o suficiente para que reverter um problema em produção leve minutos, não horas.

## Gestão de configuração por ambiente

- Variáveis de ambiente e secrets **nunca** ficam hardcoded no código nem commitadas no repositório — mesmo em projetos pequenos.
- Cada ambiente (dev/staging/produção) tem seu próprio conjunto de configuração, isolado dos demais — um secret de produção nunca deve estar acessível em staging ou localmente.
- Ao adicionar uma nova variável de ambiente/secret, documente-a na documentação viva do projeto (nome, propósito, onde é gerenciada) sem nunca registrar o valor real ali.

## Lançamento de features arriscadas

Para mudanças que têm risco maior (nova integração de pagamento, mudança de schema de dado, feature que afeta muitos usuários de uma vez):
- Prefira **feature flags** para desacoplar "o código está em produção" de "os usuários estão vendo a feature" — permite reverter comportamento sem reverter deploy.
- Considere **rollout gradual** (canary, porcentagem de usuários) quando a plataforma suportar, em vez de ligar para 100% dos usuários de uma vez.

## Antes de aprovar um deploy para produção

- [ ] O artefato foi construído a partir de um commit já validado pelo `release-gatekeeper` (nunca deploy de código não commitado ou não validado pelo CI).
- [ ] Passou por staging (quando o ambiente existir) com resultado observado, não assumido.
- [ ] Health check pós-deploy configurado e vai rodar automaticamente.
- [ ] Existe um caminho de rollback claro e testado (não só teórico).
- [ ] Nenhum secret novo foi commitado no código; configuração de ambiente está correta para o ambiente-alvo.
- [ ] Se a mudança é de alto risco, foi considerado feature flag ou rollout gradual.

## Ao revisar um projeto existente

Se pedirem para "configurar CI/CD" ou "revisar deploy" de um projeto, verifique se a esteira cobre os cinco pontos do pipeline mínimo acima. Ausência de rollback definido ou de health check pós-deploy são as lacunas mais comuns e mais caras quando algo dá errado em produção.

## Referência: GitHub Actions + Docker

Três arquivos prontos para adaptar em `assets/`:
- `cd.yml` — workflow de deploy contínuo: build e push da imagem Docker, deploy em staging com health check, promoção para produção via GitHub Environments (o `Required reviewers` do Environment "production" já funciona como o gate de aprovação manual, sem precisar de step extra no workflow), e um job de rollback manual.
- `Dockerfile` — build multi-stage (Node.js/TypeScript de exemplo), usuário não-root, `HEALTHCHECK` embutido consumido pelo `cd.yml`.
- `docker-compose.dev.yml` — ambiente de desenvolvimento local (não usar em produção).

O `cd.yml` assume que `assets/ci.yml` da skill `ci-security-gate` já rodou e passou — CD só constrói/implanta a partir de um commit que já passou pelo gate de CI. Adapte a stack (Node/Ruby/Python), o registry de imagens e os comandos reais de deploy da plataforma escolhida antes de usar em produção.

## Referência: workflow GitHub Actions com Docker

Esta skill inclui dois arquivos de referência (exemplo em Node.js/TypeScript, adaptar setup/comandos para outra stack):

- `assets/cd.yml` — workflow disparado após o CI passar (`workflow_run`), que builda e publica a imagem Docker, faz deploy em staging com health check, exige aprovação manual (via `environment: production` com required reviewers configurado nas Settings → Environments do repositório) antes de promover para produção, roda health check em produção, e tem um job de rollback dedicado.
- `assets/Dockerfile.example` — build multi-stage (build isolado do runtime final), imagem final enxuta, usuário não-root, expõe endpoint `/health` consumido pelo health check do `cd.yml`.

Copie `cd.yml` para `.github/workflows/cd.yml` e `Dockerfile.example` para `Dockerfile` na raiz do projeto, depois substitua os placeholders de deploy (`flyctl deploy ...`) pelo comando real da plataforma-alvo (Fly.io, Render, ECS, Cloud Run, Kamal, etc.) — a estrutura staging→produção com approval e o health check pós-deploy são o que deve se manter, independente da plataforma escolhida.

Se o projeto **não** usa Docker, mantenha a mesma estrutura de jobs (build do artefato → staging com health check → aprovação → produção com health check → rollback), trocando só o passo de build/push da imagem pelo equivalente do artefato usado (build estático, pacote, etc.).
