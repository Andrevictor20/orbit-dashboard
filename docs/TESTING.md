# Estratégia de Testes e Garantia de Qualidade - Orbit Dashboard

Este documento define a metodologia de testes, a arquitetura da suíte de validação e os procedimentos para execução local e automatizada dos testes no Orbit Dashboard.

---

## 1. Pirâmide de Testes e Matriz de Validação

A estratégia de testes do Orbit estrutura-se em camadas progressivas de garantia de qualidade:

```
                  / \
                 /   \           [ DAST: OWASP ZAP ]
                / E2E \          [ Playwright E2E & Visual Regression ]
               /-------\
              /  Carga  \        [ Grafana k6: Latência sob Concorrência ]
             /-----------\
            / Integração  \      [ Axum-Test & Cargo Integration Tests ]
           /---------------\
          /    Unitários    \    [ Vitest + React Testing Library & Rust Units ]
         /-------------------\
```

### Critérios e Disciplinas Inegociáveis (Anti-Test-Bypass)
- **Proibição de Mocks Cegos de Lógica Interna:** Mocks são autorizados exclusivamente para interfaces de entrada e saída externas (como requisições remotas a registros Docker públicos ou dispositivos externos do Home Assistant). Lógicas de roteamento, serialização e transformações de estado devem ser executadas nativamente.
- **Asserções Rígidas:** Testes sem asserções determinísticas ou asserções triviais são rejeitados nas revisões de código.
- **Proibição de Skips:** A suíte de produção proíbe o uso de diretivas `.skip`, `xit` ou flags de tolerância que mascarem falhas reais.
- **Testes de Regressão Obrigatórios:** Qualquer defeito reportado e corrigido deve ser precedido por um teste de regressão que reproduza a falha antes da correção.

---

## 2. Execução da Suíte de Testes Localmente

### 2.1 Testes do Backend (Rust)

A suíte de testes em Rust cobre regras de negócio, endpoints de API com simulação HTTP em memória, serialização de métricas e controle de concorrência.

#### Executar Todos os Testes do Backend
```bash
cd backend
cargo test --workspace
```

#### Verificação Estática Rápida (Typecheck e Lints)
```bash
cd backend
cargo check --tests --workspace
```

#### Auditoria de Dependências (SAST)
```bash
cd backend
cargo audit --ignore RUSTSEC-2023-0071
```

#### Testes de Mutação (Verificação de Resiliência Lógica)
```bash
cd backend
cargo mutants --no-shuffle --exclude src/main.rs
```

---

### 2.2 Testes do Frontend (Vitest & TypeScript)

A suíte de testes do frontend valida componentes React, provedores de contexto global, transformações de telemetria e fluxos de navegação.

#### Guardrails de Recursos Locais
Para prevenir consumo excessivo de memória durante a execução de múltiplos workers JSDOM em paralelo, a configuração do Vitest (`frontend/vitest.config.ts`) limita a alocação a `maxThreads: 4` e tempo limite por teste a 15 segundos.

#### Executar Todos os Testes Unitários do Frontend
```bash
cd frontend
npm test -- --run
```

#### Executar Verificação Estática de Tipos e Build
```bash
cd frontend
npm run build
```

#### Executar Linter Otimizado (`oxlint`)
```bash
cd frontend
npm run lint
```

#### Validação de Sincronização de Idiomas (i18n)
```bash
cd frontend
npm run i18n:check
```
Caso existam chaves ausentes ou divergentes entre `en.ts` e `pt.ts`, execute a sincronização automática com:
```bash
cd frontend
npm run i18n:sync
```

---

### 2.3 Testes de Ponta a Ponta (Playwright E2E)

Os testes de integração E2E validam a inicialização do assistente de configuração, o fluxo de autenticação e a navegação entre páginas em navegadores reais em modo headless (Chromium, Firefox, WebKit).

#### Executar Testes Funcionais E2E
```bash
cd frontend
npm run test:e2e
```

#### Executar Testes de Regressão Visual
Compara snapshots gráficos da interface para garantir a conformidade dos temas claro e escuro e a preservação de layouts responsivos:
```bash
cd frontend
npm run test:visual
```

---

### 2.4 Testes de Carga e Estresse (Grafana k6)

Valida o comportamento e a latência de resposta da API sob requisições concorrentes:

```bash
# Certifique-se de que a API está em execução em http://localhost:5172
k6 run backend/load-tests/smoke_test.js
```

---

## 3. Pipeline de Integração Contínua (GitHub Actions)

Toda alteração submetida por meio de *push* ou *pull request* é submetida aos seguintes estágios paralelos de validação automatizada:

| Job no Pipeline | Escopo de Validação | Ferramentas Utilizadas |
| :--- | :--- | :--- |
| `test-backend` | Testes unitários, testes de integração, SAST e carga smoke | `cargo test`, `cargo audit`, `k6` |
| `test-frontend` | Testes unitários de componentes, verificação estática de tipos e E2E | `vitest`, `playwright`, `npm audit` |
| `test-visual` | Validação de fidelidade de renderização gráfica e temas | `playwright visual snapshots` |
| `test-security-dast` | Varredura ativa de segurança de endpoints em runtime | `OWASP ZAP API Scan` |
| `test-mutation` | Análise de cobertura lógica profunda via mutação | `cargo-mutants` |

Aprovação em 100% dos estágios do pipeline é pré-requisito mandatório para a publicação e geração automática das imagens de release multi-arquitetura (`linux/amd64` e `linux/arm64`).
