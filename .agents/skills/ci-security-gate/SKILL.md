---
name: ci-security-gate
description: Gate de integração contínua e segurança — pipeline de lint, auditoria de dependências, análise estática de segurança e testes que deve rodar em todo commit, tratando segurança como hábito distribuído em cada mudança, não como fase isolada no final. Inclui um workflow de referência em GitHub Actions (assets/ci.yml). Use esta skill sempre que for validar se uma mudança está pronta para commit/merge, sempre que configurar ou revisar um pipeline de CI (incluindo GitHub Actions), e sempre que uma mudança tocar em autenticação, dados de usuário, chamadas a serviços externos, upload de arquivos, ou qualquer superfície exposta a input não confiável. Ative também quando o usuário pedir para "revisar segurança" de um projeto ou "configurar CI".
---

# CI & Security Gate

## Pipeline mínimo, rodando em TODO commit

1. **Lint/estilo** — consistência de código (ex.: RuboCop, ESLint, Ruff, etc., conforme a stack).
2. **Auditoria de dependências** — checagem de vulnerabilidades conhecidas nas bibliotecas usadas.
3. **Análise estática de segurança** — ferramenta apropriada à stack (ex.: Brakeman para Rails, Bandit para Python, Semgrep genérico) buscando padrões perigosos (SQL injection, path traversal, redirect aberto, SSRF, etc.).
4. **Suíte de testes completa** — ver skill `tdd-safety-net` para o padrão de cobertura esperado.

Nenhuma dessas etapas é opcional para código que vai a produção. Se o projeto ainda não tem uma delas configurada, sinalize isso como lacuna antes de continuar adicionando features.

## Segurança é hábito, não fase

- Corrija problemas de segurança **no momento em que a análise estática ou o teste os aponta**, no mesmo commit — não acumule para uma "sprint de segurança" depois.
- Ao implementar qualquer funcionalidade que toque nas superfícies abaixo, verifique proativamente (mesmo que não tenha sido pedido explicitamente):
  - **Input de usuário não confiável** → validação, sanitização, proteção contra injection.
  - **Requisições a URLs/hosts fornecidos por usuário** → risco de SSRF; valide/restrinja destinos.
  - **Uploads e arquivos** → risco de path traversal; nunca confie em nome/caminho fornecido pelo cliente sem normalizar.
  - **Endpoints de alta frequência (login, reset de senha, formulários públicos)** → rate limiting.
  - **Dados sensíveis em repouso** → considerar encryption at rest quando aplicável.
  - **Redirecionamentos baseados em parâmetro** → risco de open redirect.
- Se um warning de análise estática for um falso positivo real (ex.: interpolação SQL usando apenas paths de config internos, nunca input de usuário), documente por que é seguro ignorá-lo em vez de simplesmente suprimir sem explicação — isso deve ficar registrado (ver skill `living-docs-keeper`) para não virar uma dúvida recorrente.

## Por que isso importa mais com agente de IA

Um agente de IA implementa o que é pedido com entusiasmo, mas **raramente sugere proteções que não foram pedidas explicitamente** — ele não prioriza sozinho. Isso significa que a checagem de segurança proativa (a lista de superfícies acima) precisa ser um hábito explícito de quem está orientando o trabalho, reforçado por esta skill, e não algo que se espera que o agente traga por conta própria.

## Antes de aprovar um commit/merge

- [ ] Lint passou limpo?
- [ ] Nenhuma dependência com vulnerabilidade conhecida sem justificativa documentada?
- [ ] Análise estática de segurança sem warnings novos (ou com warnings existentes documentados como falso positivo)?
- [ ] Suíte de testes completa passa?
- [ ] Se a mudança toca em alguma superfície sensível da lista acima, a proteção correspondente foi considerada (mesmo que a conclusão seja "não se aplica aqui")?

## Ao revisar um projeto existente

Se pedirem para "revisar segurança" de um projeto, não se limite a rodar a ferramenta de análise estática uma vez — verifique se o pipeline acima está de fato configurado para rodar em **todo commit automaticamente** (não manualmente, sob demanda). Ausência de automação é, em si, o principal risco a reportar.

## Referência: GitHub Actions

Há um workflow de CI pronto para adaptar em `assets/ci.yml` (lint → auditoria de dependências → análise estática de segurança → testes → build de imagem Docker para validação). Ele assume Node.js/TypeScript com Docker; os comentários no arquivo indicam onde trocar comandos para Ruby, Python ou outra stack. Use-o como ponto de partida ao configurar CI em GitHub Actions, ajustando ao gerenciador de pacotes e às ferramentas de lint/segurança reais do projeto.

## Referência: workflow GitHub Actions

`assets/ci.yml` traz um workflow de referência (exemplo em Node.js/TypeScript) implementando o pipeline mínimo acima: lint, auditoria de dependências, análise estática de segurança (Semgrep como exemplo — trocar por Brakeman/Bandit/CodeQL conforme a stack) e testes, cada um como job separado. Copie para `.github/workflows/ci.yml` e adapte os comandos de setup/instalação para a stack real do projeto — a estrutura de jobs e o princípio de "todo commit passa por todos eles" se mantêm independente da linguagem.

Configure os jobs como **required status checks** nas branch protection rules do repositório — sem isso, o workflow roda mas não impede merge de código que falhou.
