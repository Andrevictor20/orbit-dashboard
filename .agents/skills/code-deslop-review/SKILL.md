---
name: code-deslop-review
description: "Revisão e remoção sistemática de 'slop' (vícios, poluição e código desnecessário) gerado por IA antes de commits, PRs e releases. Impõe a regra 'No God Files' (< 500 linhas) e mantém o código limpo, idiomático e enxuto."
---

# Code Deslop Review: Limpeza Sistemática de Código de IA

> **Propósito:** Agentes de IA frequentemente geram código verboso, com comentários óbvios, verificações defensivas anormais, typecasts preguiçosos e estruturas profundamente aninhadas. Esta skill executa uma varredura de limpeza e refinamento antes de qualquer entrega.

---

## 1. As 5 Dimensões de Deslop de Código

Revise o diff contra o branch principal verificando:

### 1.A Remoção de Comentários Óbvios & Redundantes
- **Slop:** Comentários que apenas repetem o que a linha de código já expressa claramente:
  ```typescript
  // ❌ SLOP:
  // set user status to active
  user.status = "active";
  // loop through all items in list
  for (const item of items) { ... }
  ```
- **Código Limpo:** Mantenha apenas comentários que explicam o **PORQUÊ** de uma decisão não-óbvia ou restrição externa de negócio.

### 1.B Eliminação de Checagens Defensivas Excessivas
- **Slop:** Blocos `try/catch` vazios ou verificações desnecessárias de `null/undefined` em caminhos internos seguros e totalmente tipados.
- **Código Limpo:** Confie na integridade garantida pelas fronteiras de validação (Zod, Schemas). Trate erros reais onde eles podem de fato ocorrer.

### 1.C Achatamento de Estruturas com Early Returns
- **Slop:** Árvores de `if/else` com 4 a 6 níveis de profundidade.
- **Código Limpo:** Inverta as condições e use retornos precoces (*guard clauses / early returns*) para manter o fluxo principal na primeira coluna de indentação.

### 1.D Eliminação de Typecasts Preguiçosos
- **Slop:** Uso de `as any`, `!` ou `as unknown as Type` para forçar o código a compilar sem corrigir o contrato.
- **Código Limpo:** Tipos verdadeiros e coerentes com a realidade dos dados.

### 1.E Código Morto & Abstrações Prematuras
- **Slop:** Funções utilitárias "para o futuro", parâmetros não utilizados, logs de debug esquecidos e importações sem uso.
- **Código Limpo:** Apenas o estritamente necessário para o escopo da tarefa atual.

---

## 2. A Regra "No God Files" (< 500 Linhas por Arquivo)

- **Cap Rígido de Linhas:** Nenhum arquivo de código de produção deve ultrapassar **500 linhas** (testes e mocks isolados são exceções toleradas).
- **Separação Obrigatória de Responsabilidades:** Nunca misture em um único arquivo:
  1. *Contratos / Interfaces de Tipos* (`types.ts`);
  2. *Registros e Mapeamentos* (`registry.ts`);
  3. *Implementações de Domínio / Serviços* (`service.ts`);
  4. *Helpers Utilitários e Formatação* (`utils.ts`).
- Se um arquivo estiver próximo de 500 linhas, desmembre-o em módulos coesos e nomeados antes de finalizar a entrega.
