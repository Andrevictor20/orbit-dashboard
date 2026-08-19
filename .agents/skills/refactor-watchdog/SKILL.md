---
name: refactor-watchdog
description: Vigilância de refactoring contínuo — detectar duplicação e arquivos/módulos crescendo demais cedo, e extrair/DRY imediatamente em vez de deixar acumular para uma "refatoração de emergência" depois. Use esta skill sempre que estiver adicionando código a um arquivo ou módulo já existente, sempre que perceber padrões duplicados entre dois ou mais arquivos, e sempre antes de considerar uma feature "concluída" em um arquivo que já está grande. Ative com prioridade alta quando um único arquivo ultrapassar um tamanho que dificulte a leitura completa (referência prática: acima de ~800-1000 linhas já é um sinal de atenção; acima de ~2000, ação corretiva é recomendada), ou quando notar o padrão "construir-construir-construir-parar-refatorar" se formando.
---

# Refactor Watchdog

## Papel do agente vs. papel do humano nesta prática

O agente **empilha código por padrão** — ele não refatora sozinho a menos que seja instruído a olhar para isso explicitamente. Cabe ao humano decidir **o quê** extrair e **como** a interface deve ficar; cabe ao agente **executar** a extração rapidamente uma vez decidido.

Como agente rodando esta skill, seu papel é **detectar e sinalizar** o momento de refatorar — e propor a extração — não esperar passivamente até que o humano perceba.

## Gatilhos para propor refactor imediatamente

Proponha um refactor (pequeno, no mesmo ciclo de trabalho, não depois) quando notar:

1. **Duplicação real** — o mesmo padrão de lógica (não só sintaxe parecida) aparecendo em 2+ lugares. Regra prática: na segunda ocorrência, já vale extrair; não espere a terceira.
2. **Arquivo/módulo fazendo mais de uma responsabilidade** — se você não consegue descrever o arquivo em uma frase sem usar "e" mais de uma vez, é candidato a divisão.
3. **Crescimento sustentado sem pausa** — um arquivo que só cresce a cada tarefa nova, nunca encolhe, é o padrão que leva à "espiral" (ver anti-padrão abaixo).
4. **Tamanho absoluto** — acima de ~800-1000 linhas em um único arquivo já é um sinal de atenção; sugira uma divisão antes de adicionar a próxima feature ali. Acima de ~2000 linhas, trate como prioridade, não como "quando sobrar tempo".

## Como propor o refactor

- Refactors bons e contínuos são **pequenos e rápidos** (minutos, não horas) porque são feitos cedo, com testes já existentes cobrindo o comportamento.
- Ao propor, use nomenclatura clara do que está sendo extraído (ex.: "Extract X wrapper", "DRY os N métodos de Y em um método parametrizado") — isso também alimenta a skill `atomic-commit-discipline`.
- Certifique-se de que a suíte de testes (ver skill `tdd-safety-net`) cobre o comportamento **antes** de mover código — refactor sem rede de segurança é reescrita disfarçada, com risco de regressão silenciosa.

## Anti-padrão a evitar: "construir-construir-construir-parar-refatorar"

Este é o padrão do contra-exemplo de referência (projeto sem disciplina, mesmo dev e mesmo agente do case comparativo): um arquivo cresce continuamente por dezenas de commits sem nenhuma extração, chega a milhares de linhas, e só então sofre uma "cirurgia de emergência" — um commit único, grande, movendo centenas de linhas para vários arquivos novos, com alto risco de quebrar algo por causa do tamanho da mudança.

Métricas observadas nesse padrão problemático, para referência de comparação:
- Um único arquivo cresceu ~10x ao longo de ~54 commits (de ~500 para ~5000 linhas) antes da primeira grande refatoração.
- Foram necessárias 6 rodadas de refatoração de emergência ao longo do projeto para trazer o arquivo de volta a um tamanho gerenciável.
- O throughput de commits/dia caiu a menos de 1/3 comparado ao projeto que fez refactor contínuo desde o início.

Se você notar esse padrão se formando (crescimento contínuo sem nenhuma extração por muitos commits seguidos), **interrompa o fluxo de features e proponha uma pausa para refactor antes de continuar adicionando código novo** — não espere o humano perceber sozinho.

## Checklist antes de adicionar código a um arquivo existente

- [ ] Este arquivo já está grande o suficiente para merecer divisão antes de crescer mais?
- [ ] Existe lógica parecida em outro lugar do projeto que eu deveria consolidar em vez de duplicar?
- [ ] Se vou extrair algo, os testes que cobrem esse comportamento já existem (ou preciso escrevê-los antes de mexer)?
- [ ] O refactor proposto é pequeno o suficiente para ser um commit isolado e rápido (não uma reescrita de horas)?
