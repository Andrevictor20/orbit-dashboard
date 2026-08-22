# 🧪 Estratégia de Testes e Garantia de Qualidade

O Orbit Dashboard adota uma cultura rigorosa de **Test-Driven Development (TDD)** e disciplina de validação contínua em múltiplos níveis de abstração.

---

## 🏔️ A Pirâmide de Testes do Orbit

```
           / \
          /   \         [ DAST & OWASP ZAP ] -> Segurança Dinâmica
         / E2E \        [ Playwright E2E & Visual ] -> Interface do Usuário
        /-------\
       /  Load   \      [ Grafana k6 ] -> Testes de Carga & Latência
      /-----------\
     / Integration \    [ Axum-Test & Cargo Tests ] -> Rotas, Auth & Docker API
    /---------------\
   /   Unit Tests    \  [ Vitest, React Testing Library, Rust Unit Tests ]
  /-------------------\
```

---

## 🛠️ Executando os Testes Localmente

### 1. Testes do Backend (Rust)
Para rodar toda a suíte de testes unitários e de integração do backend:
```bash
cd backend
cargo test
```

Para verificar vulnerabilidades estáticas em dependências (SAST):
```bash
cd backend
cargo audit --ignore RUSTSEC-2023-0071
```

Para rodar testes de mutação (verificar resiliência lógica dos testes):
```bash
cd backend
cargo mutants --no-shuffle --exclude src/main.rs
```

---

### 2. Testes do Frontend (Vitest)
Para rodar os testes unitários e de componentes React:
```bash
cd frontend
npm test
```

Para executar o linter ultrarrápido:
```bash
cd frontend
npm run lint
```

Para verificar tipagem estática com TypeScript:
```bash
cd frontend
npm run build
```

---

### 3. Testes End-to-End (Playwright)
Para rodar os testes de ponta a ponta que validam o fluxo completo de autenticação, navegação e catálogo da loja:
```bash
cd frontend
npm run test:e2e
```

Para rodar a suíte de **Regressão Visual**:
```bash
cd frontend
npm run test:visual
```

---

### 4. Testes de Carga & Performance (Grafana k6)
O teste de carga *Smoke* valida que a API responde com latência inferior a 200ms sob concorrência:
```bash
# Com o backend rodando em http://localhost:5172
k6 run backend/load-tests/smoke_test.js
```

---

## 🔄 Automação Contínua (GitHub Actions)

Toda alteração enviada para o repositório é validada em paralelo por 5 jobs independentes no GitHub Actions:

| Job | Escopo | Ferramentas |
| :--- | :--- | :--- |
| `test-backend` | Testes Rust, SAST e Teste de Carga Smoke | `cargo test`, `cargo audit`, `k6` |
| `test-frontend` | Testes unitários, validação de tipos e E2E | `vitest`, `playwright`, `npm audit` |
| `test-visual` | Fidelidade visual de layout e modo escuro | `playwright` snapshots |
| `test-security-dast` | Varredura de vulnerabilidades de API em runtime | `OWASP ZAP API Scan` |
| `test-mutation` | Análise profunda de mutação de código | `cargo-mutants` |
