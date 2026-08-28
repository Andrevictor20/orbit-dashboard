---
name: zero-downtime-deployment
description: "Estratégias de deploy sem indisponibilidade (Zero-Downtime), Blue/Green, Canary Releases com tráfego gradual, Rolling Updates com probes de liveness/readiness, padrão Expand-and-Contract de banco/API e automação de rollback imediato."
---

# Zero-Downtime Deployment & Automated Rollback

> **Propósito:** Garantir que novas versões do software entrem em produção com **zero interrupção de serviço para os usuários**, através de deploys graduais, compatibilidade retroativa paralela e gatilhos de reversão instantânea em caso de anomalias.

---

## 1. As 3 Estratégias Canônicas de Deploy

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Blue/Green Deployment                                    │
│    Dois ambientes idênticos. Switch instantâneo de roteador │
├─────────────────────────────────────────────────────────────┤
│ 2. Canary Release                                           │
│    Roteamento gradual: 1% → 10% → 50% → 100% com validação  │
├─────────────────────────────────────────────────────────────┤
│ 3. Rolling Update                                           │
│    Substituição pod a pod com Readiness/Liveness Probes     │
└─────────────────────────────────────────────────────────────┘
```

---

### 1.A Blue/Green Deployment
- **Como funciona:** Mantém o ambiente atual (**Blue**) ativo recebendo 100% do tráfego enquanto o novo ambiente (**Green**) é provisionado e testado em isolamento.
- **Transição:** Quando a suíte de *smoke tests* no Green passar, o balanceador de carga / Ingress alterna 100% do tráfego para o Green.
- **Vantagem:** Rollback quase instantâneo (basta redirecionar o tráfego de volta para o Blue se houver falhas).

---

### 1.B Canary Release (Lançamento Canário Gradual)
- **Como funciona:** Roteia uma pequena porcentagem do tráfego real de usuários para a nova versão enquanto a versão antiga atende a maioria.
- **Esteira de Progressão de Tráfego:**
  1. `Etapa 1 (1% - 5%)`: Executar por 5-10 minutos. Monitorar métricas RED (*Rate, Errors, Duration*).
  2. `Etapa 2 (10% - 25%)`: Executar por 15 minutos. Monitorar taxas de erro HTTP 5xx e consumo de CPU/memória.
  3. `Etapa 3 (50%)`: Executar por 15 minutos. Validar latência p95/p99.
  4. `Etapa 4 (100%)`: Promoção total da nova versão para produção.

---

### 1.C Rolling Updates com Probes no Kubernetes / Docker
- **Configuração Obrigatória de Probes:**
  - **Startup Probe:** Aguarda a inicialização e aquecimento da aplicação antes de acionar outras probes.
  - **Readiness Probe:** Garante que o container só receba tráfego de usuários quando estiver 100% pronto (ex: conexões de banco de dados e caches estabelecidos).
  - **Liveness Probe:** Reinicia o container se o processo travar ou entrar em deadlock.
- **Graceful Shutdown:** A aplicação deve escutar o sinal `SIGTERM`, parar de aceitar novas requisições, concluir as requisições em andamento (drain de 15 a 30s) e fechar conexões de banco de dados antes de encerrar.

---

## 2. O Padrão Expand-and-Contract (Compatibilidade de Banco e APIs)

Para que versões antigas e novas coexistam simultaneamente sem erros durante o deploy:

1. **Fase 1 (Expand):** Adicione a nova coluna/tabela no banco como opcional (`NULLABLE` ou com default) e crie o novo endpoint de API mantendo o antigo ativo.
2. **Fase 2 (Deploy Paralelo):** A nova versão do código grava tanto na estrutura nova quanto na antiga (ou migra gradualmente).
3. **Fase 3 (Contract):** Após 100% do tráfego estar na nova versão e estável por N dias, remova a coluna/tabela antiga e descontinue o endpoint legado.

---

## 3. Playbook de Rollback Automatizado Instantâneo

### Gatilhos Imediatos de Rollback (Abort Triggers):
- **Taxa de Erro:** Taxa de respostas HTTP 5xx superior a `1%` por mais de 2 minutos consecutivos.
- **Latência:** Aumento superior a `50%` na latência p99 em comparação com a versão anterior.
- **Health Check:** Falha em 3 probes consecutivas de `Readiness`.
- **Unhandled Exceptions:** Picos anômalos de crashes ou panics não capturados.

### Execução de Rollback:
1. Reverter o roteamento de tráfego imediatamente para a versão estável anterior (`kubectl rollout undo` ou switch de router).
2. Manter os logs e traces da versão com falha para investigação sistemática de causa raiz (`systematic-debugging`).
3. Registrar o incidente e notificar o time.
