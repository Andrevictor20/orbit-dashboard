---
name: no-workarounds
description: "Disciplina estrita de correção de causa raiz. Proíbe expressamente workarounds, remendos e supressões que apenas calam o compilador, linter ou runtime sem resolver a fonte do problema."
---

# No Workarounds: Corrija a Fonte, Nunca Silencie o Sinal

> **Princípio:** Um *workaround* (gambiarra/remendo) é qualquer alteração que faz o sintoma parar de se manifestar sem resolver a causa real da sua existência. Ele mascara a falha enquanto a dívida técnica se espalha silenciosamente pelo sistema.
> **Fix the source, not the signal.**

---

## 1. O Portão de Decisão (The Gate)

Antes de aprovar ou commitar qualquer correção, responda com rigor:
1. Esta alteração conserta a **causa raiz** ou apenas impede o sintoma de aparecer?
2. Estou **resolvendo a fonte** ou apenas **silenciando o sinal** (compilador, linter, runtime)?

Uma correção só está pronta quando o código fica no estado em que deveria ter sido escrito desde o início, sem necessidade de typecasts arbitrários, supressões de linter ou esperas artificiais.

---

## 2. Os Sete Sinais de Workaround

Cada uma das categorias abaixo representa um mecanismo em que o compilador, linter ou testes estão avisando sobre um problema real. Corrija o que o sinal aponta:

| Categoria | O Sinal Silenciado | A Causa Real e Como Corrigir na Fonte |
| :--- | :--- | :--- |
| **TYPE** | `as any`, `as unknown as T`, `!`, type assertions soltas | O sistema de tipos detectou uma incoerência. Corrija a tipagem ou valide dados externos na fronteira via Zod/Schemas. |
| **LINT** | `eslint-disable`, `@ts-ignore`, `@ts-expect-error` | A análise estática encontrou um risco real. Corrija o padrão apontado pela regra. |
| **SWALLOW** | `catch {}` vazio, `.catch(() => null)`, fallback silencioso | Ocorreu uma falha e o código finge que nada aconteceu. Trate o erro de forma contextual e logue ou retorne um Result tipado. |
| **TIMING** | `setTimeout`, `sleep(1000)`, retries cegos com delays fixos | Código executando fora de ordem ou race condition. Coordene eventos reais de prontidão ou use polling condicional em testes. |
| **PATCH** | Mutação de protótipo global ou monkey patching | A biblioteca não atende à necessidade. Use um adapter/wrapper explícito ou o ponto de extensão oficial da lib. |
| **SCATTER** | Uso defensivo massivo de `?.` e `??` encadeados por toda parte | Os dados chegam corrompidos ou imprevisíveis. Valide a integridade dos dados UMA vez na entrada e confie na estrutura. |
| **CLONE** | Copiar e colar blocos com pequenas variações | A abstração atual não encaixa. Extraia o padrão compartilhado ou desenhe uma função com responsabilidade clara. |

---

## 3. A Válvula de Escape Controlada (Bugs em Dependências Upstream)

Nem toda causa raiz está sob seu controle direto. Um workaround temporário é estritamente tolerado **APENAS SE TODOS OS 4 PONTOS FOREM VERDADEIROS**:

1. A causa raiz está comprovadamente em código externo de terceiro (biblioteca upstream).
2. A correção oficial depende de um release upstream com cronograma incerto.
3. O custo de não entregar a funcionalidade agora supera a dívida técnica incorrida.
4. O workaround está 100% isolado (não vaza para o restante da base de código).

### Procedimento Obrigatório de Contenção:
1. **Comentário de Rastreio:** Adicione `// WORKAROUND: [motivo exato] — ver [link da issue pública / PR]`
2. **Teste Canário:** Escreva um teste automatizado que **FALHARÁ** assim que a dependência for atualizada com o fix oficial, alertando a equipe para remover o workaround.
3. **Data Limite:** Registre a dívida técnica no `PROJECT_MEMORY.md` com prazo de revisão máximo de 90 dias.
