---
name: lesson-learned
description: "Protocolo de captura e formalização de lições aprendidas (L-001..L-NNN) com causa raiz comprovada e regras práticas para a memória procedural. Garante que problemas difíceis e peculiaridades de bibliotecas nunca sejam repetidos em sessões futuras."
---

# Institutional Lessons Learned: Memória Procedural Permanente

> **Propósito:** Quando um bug difícil é resolvido, um comportamento inesperado de biblioteca é superado ou um detalhe sutil de infraestrutura é descoberto, essa informação deve ser formalizada imediatamente como uma lição aprendida (`L-001..L-NNN`) para alimentar a **Memória Procedural** do projeto.

---

## 1. Estrutura Canônica de uma Lição Aprendida

Toda nova lição aprendida deve responder com precisão:

```markdown
### 📘 [L-NNN] Título Claro do Problema e Contexto

- **Contexto & Sintoma:** O que falhou e como o erro se manifestou?
- **Causa Raiz Confirmada:** Por que o problema realmente aconteceu (explicando a mecânica técnica, não apenas a suposição)?
- **Evidência Comprovada:** Teste ou comando que capturou e comprovou a resolução.
- **Regra Prática para o Futuro:** O que fazer e o que NUNCA fazer daqui para frente neste repositório.
```

---

## 2. Exemplos de Lições Aprendidas

### Exemplo 1: Peculiaridade de Biblioteca / Framework
```markdown
### 📘 [L-001] Mutação Silenciosa de Estado no Hook useSyncExternalStore
- **Contexto & Sintoma:** Componentes da barra lateral não renderizavam as atualizações de estado do WebSocket.
- **Causa Raiz Confirmada:** O seletor retornava uma nova referência de array a cada tick, causando re-renderizações infinitas que eram ignoradas pelo bail-out do React.
- **Evidência Comprovada:** `test/sidebar-sync.test.ts` passando com equality function customizada.
- **Regra Prática:** Sempre envolva seletores que retornam arrays/objetos em `useCallback` ou passe comparadores por valor para o snapshot.
```

### Exemplo 2: Quirks de Ambiente / Mobile Viewport
```markdown
### 📘 [L-002] Saltos de Layout no iOS Safari com `h-screen`
- **Contexto & Sintoma:** O botão de CTA inferior era coberto pela barra retrátil de navegação no iPhone.
- **Causa Raiz Confirmada:** `100vh` no WebKit do iOS ignora a barra inferior dinâmica do navegador.
- **Evidência Comprovada:** Validação via device emulator.
- **Regra Prática:** Use estritamente `min-h-[100dvh]` em containers de tela cheia. `100vh` é proibido em heroes e modais.
```

---

## 3. Conexão com a Memória de Projeto

Ao registrar uma lição aprendida:
1. O agente `archivist` inclui um resumo de 1-2 linhas na seção **6. Gotchas, Hurdles & Learned Playbooks (Procedural Memory)** do arquivo `.agents/memory/PROJECT_MEMORY.md`.
2. Em novas sessões, o `orchestrator` lê essa seção no **Passo 0 (Fast Context Bootstrap)**, garantindo que o agente já inicie o chat ciente das armadilhas conhecidas do projeto.
