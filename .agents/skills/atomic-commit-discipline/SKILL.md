---
name: atomic-commit-discipline
description: Disciplina de "small releases" — cada commit é pequeno, categorizado, e production-ready por definição, nunca "quebrando temporariamente". Use esta skill sempre que for preparar, agrupar ou escrever uma mensagem de commit, sempre que uma tarefa terminar e for hora de consolidar a mudança, ou sempre que notar que uma mudança está ficando grande demais para um único commit. Ative também quando o usuário pedir para revisar o histórico de commits de um projeto conduzido com IA, avaliar se o ritmo de entrega está saudável, ou organizar um changelog.
---

# Atomic Commit Discipline

## Regra de ouro

**Todo commit em branch principal passa no CI completo e é, por definição, deployável.** Não existe "commit quebrando que conserta no próximo". Se uma mudança não está pronta para produção, ela não vai para o branch principal ainda.

## Tamanho e escopo do commit

- Um commit = uma unidade de mudança coerente: uma feature pequena, um fix, um refactor, um ajuste de config. Não misture categorias diferentes no mesmo commit (ex.: não junte um refactor grande com uma feature nova).
- Se, ao preparar um commit, você perceber que ele mistura mais de uma preocupação, pare e separe em commits sequenciais menores antes de seguir.
- Prefira várias entregas pequenas ao longo do dia a uma única entrega grande no fim — isso é "integração contínua de verdade", não uma versão disfarçada de merge grande no fim de um ciclo longo.

## Convenção de mensagem (categorização por prefixo)

Use prefixos que tornem o histórico auditável por categoria:

| Prefixo | Quando usar |
|---|---|
| `Add ...` | Feature nova |
| `Fix ...` | Correção de bug |
| `Harden ...` | Tornar algo mais robusto a falhas/edge cases, sem mudar comportamento principal |
| `Extract ...` | Refactor que isola/move código para um novo módulo/serviço |
| `DRY ...` | Refactor que remove duplicação |
| `Rework ...` / `Replace ...` | Reescrita ou substituição de abordagem existente |

Mensagens devem ser específicas o suficiente para que alguém (ou outro agente) entenda o que mudou sem abrir o diff — evite mensagens genéricas como "updates" ou "fixes".

## Antes de finalizar um commit, valide

1. O commit passa no pipeline de CI completo (lint, segurança, testes) — veja a skill `ci-security-gate` para o detalhe do pipeline.
2. O commit está categorizado corretamente com o prefixo certo.
3. O commit não deixa o projeto em estado pior do que estava antes (nada quebrado, nenhum teste pulado).
4. Se a mudança for grande, ela foi quebrada em múltiplos commits menores e sequenciais, cada um validável isoladamente.

## Sinais de alerta a reportar

- Commits muito grandes e infrequentes (ex.: um commit por dia com centenas de arquivos) — geralmente indica falta de integração contínua real, ou que uma refatoração de emergência está sendo necessária (ver skill `refactor-watchdog`).
- Mensagens de commit vagas demais para reconstruir o histórico do projeto.
- Qualquer commit que não passou no CI sendo enviado "temporariamente" com a intenção de corrigir depois.

## Uso em auditoria de projeto

Se pedirem para avaliar a saúde de um projeto pelo histórico de commits, calcule e reporte:
- % de commits por categoria (feature vs. fix vs. refactor/hardening vs. segurança vs. infra vs. testes vs. docs) — um projeto saudável raramente tem mais de ~40-50% só de features novas; o resto é o trabalho que sustenta o sistema em produção.
- Commits por dia (throughput) e se há padrão de "explosão seguida de silêncio" (sinal de commits grandes/infrequentes em vez de small releases).
- Se há evidência de commits de refatoração de emergência (muitas linhas movidas de uma vez, especialmente logo após um período de crescimento rápido de um único arquivo).
