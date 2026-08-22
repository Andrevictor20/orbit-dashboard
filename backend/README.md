# Orbit Backend

## Testes de Carga (Load Testing)

Utilizamos o **k6** para rodar testes de carga contra a API em Rust. 

### Como executar
1. Certifique-se de ter o [k6 instalado](https://k6.io/docs/get-started/installation/) na sua máquina.
2. Inicie o servidor backend em um terminal (`cargo run`).
3. Em outro terminal, navegue até a pasta `backend` e rode um dos testes:

**Smoke Test (Teste de Fumaça Rápido)**
```bash
k6 run load-tests/smoke_test.js
```

**Load Test (Teste de Carga Real)**
```bash
k6 run load-tests/load_test.js
```

Você pode passar variáveis de ambiente se a API estiver rodando em outra URL:
```bash
k6 run -e BASE_URL=http://api.staging.orbit.com load-tests/smoke_test.js
```
