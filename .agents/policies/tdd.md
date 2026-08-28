# TDD, Matriz de Testes & Anti-Test-Bypass Policy

- **Ciclo Estrito RED → GREEN → REFACTOR**: Todo comportamento de produção deve ser precedido por um teste automatizado falhando.
- **Investigação de Causa Raiz Prévia (`systematic-debugging`)**: Em correções de bugs, é obrigatório isolar a causa raiz exata antes de escrever o teste de regressão e o código de produção.
- **A Regra dos 3 Fixes**: Se 3 tentativas consecutivas de correção falharem, o ciclo deve ser pausado para revisão arquitetural em vez de acumular remendos.

---

## 1. Matriz de Tipos de Teste (Multi-Layer Testing)

O agente `test-guardian` e o `builder` devem aplicar o tipo correto de teste para cada camada da aplicação:

1. **Testes Unitários:** Isolados e ultra-rápidos. Testam funções puras, entidades de domínio e regras de negócio sem I/O real.
2. **Testes de Integração:** Validam fronteiras reais com banco de dados, transações, filas, endpoints HTTP e adapters de infraestrutura.
3. **Testes de Contrato / Schema:** Validam que schemas de request/response e payloads de eventos respeitam a tipagem esperada entre serviços e frontend.
4. **Testes de Regressão:** Prova incontestável de bugs resolvidos. Escritos antes de qualquer alteração no código de produção.
5. **Testes End-to-End (E2E):** Validam a jornada do usuário e fluxos críticos completos do sistema (ex: checkout, login, onboarding).
6. **Testes Baseados em Propriedade / Fuzzing:** Testam invariantes com centenas de entradas geradas aleatoriamente para descobrir edge cases inesperados.
7. **Testes de Segurança (SAST / DAST):** Casos de teste específicos para injeção (SQLi, XSS), controle de acesso (BOLA/IDOR) e vazamento de tokens.
8. **Testes de Performance & Carga:** Verificação de latência sob concorrência e detecção de vazamentos de memória antes de grandes releases.

---

## 2. Proibição Inegociável de Burlar Testes (Anti-Test-Bypass Rules)

> **⚠️ REGRA DE INTEGRIDADE (ANTI-TEST-BYPASS):** Qualquer tentativa de fazer a suíte passar sem executar a lógica real ou sem asserções verdadeiras é uma violação grave e BLOQUEIA releases.

### Os 7 Pecados Capitais de Testes:
1. **Mocks Cegos e Excessivos:** É proibido mocar a função que está sendo testada ou mocar todas as dependências internas a ponto de o teste rodar apenas mocks e nunca o código real. Mocks são restritos a I/O externo não-determinístico (ex: gateways de pagamento de terceiros).
2. **Asserções Vazias / Falsas:** É proibido testes sem asserções, testes com `expect(true).toBe(true)` ou testes que apenas chamam uma função sem checar o resultado retornado.
3. **Skips Não Autorizados:** É expressamente proibido adicionar `.skip`, `xit`, `@pytest.mark.skip` ou flags `--passWithNoTests` para esconder testes falhando.
4. **Deleção ou Comentamento de Testes Quebrados:** Nunca delete ou comente um teste falhando. Se o teste quebrou, o código de produção deve ser corrigido ou o teste deve ser formalmente adaptado à nova regra de negócio com justificativa documentada.
5. **Asserção de Tipo em vez de Valor:** É proibido checar apenas `expect(typeof res).toBe("object")` quando os campos e valores de negócio (`id`, `status`, `amount`) devem ser validados.
6. **Testes Tautológicos:** Testes que reproduzem a própria implementação interna em vez de testar o comportamento observável.
7. **Fabricação de Evidências:** É proibido declarar verbalmente que testes passaram sem execução nativa comprovada no terminal.
