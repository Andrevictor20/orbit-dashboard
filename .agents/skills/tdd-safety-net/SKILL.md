---
name: tdd-safety-net
description: "Garante a aplicação estrita do ciclo RED-GREEN-REFACTOR, matriz multi-camadas de testes (Unitário, Integração, Contrato, Regressão, E2E, Fuzzing) e proíbe expressamente qualquer forma de burla de testes (Anti-Test-Bypass)."
---

# TDD Safety Net & Anti-Test-Bypass

> **Princípio:** O desenvolvimento é estritamente orientado a testes (Red → Green → Refactor). Um teste só tem valor se tiver a capacidade real de **falhar quando a implementação estiver incorreta** e **comprovar o comportamento esperado**.

---

## 1. Diretrizes Fundamentais do Ciclo TDD

1. **Nunca implemente antes do RED:** Exceto para spikes descartáveis explícitos, nenhuma lógica de negócio é escrita antes do teste que comprova sua necessidade.
2. **Cobertura de Comportamento Real:** Avalie a qualidade dos testes por *behavior coverage*, *critical path coverage* e validação de contratos/limites, nunca por quantidade bruta de linhas de código.
3. **Matriz de Testes Adaptativa:**
   - *Unitário:* Para algoritmos, regras de negócio e funções puras.
   - *Integração:* Para transações de banco, queries SQL, adapters e endpoints HTTP.
   - *Contrato:* Para compatibilidade de schemas e APIs.
   - *Regressão:* Para provar bugs e blindar o sistema contra reincidência.
   - *E2E:* Para fluxos de jornada crítica do usuário.
   - *Propriedade/Fuzzing:* Para testar invariantes matemáticas e limites de entrada.

---

## 2. Protocolo Anti-Test-Bypass (Proibição de Burlar Testes)

Antes de considerar um teste como válido, verifique se ele não comete nenhuma das infrações abaixo:

- [ ] **O teste executa o código real?** (Proibido mocar o próprio código em teste ou mocar em excesso).
- [ ] **O teste contém asserções de valor precisas?** (Proibido testes sem asserções, com `assert(true)` ou que apenas checam tipos em vez de dados).
- [ ] **Nenhum teste foi silenciado com `.skip` ou `xit`?** (Proibido pular testes falhando).
- [ ] **Nenhum teste existente quebrado foi deletado ou comentado?** (Erros devem ser corrigidos na causa raiz do código de produção).
- [ ] **A evidência foi capturada via terminal nativo?** (Proibido forçar aprovação sem execução real da toolchain).
