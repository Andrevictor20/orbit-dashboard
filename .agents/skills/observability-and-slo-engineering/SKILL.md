---
name: observability-and-slo-engineering
description: "Engenharia de observabilidade, telemetria e governança de SLOs. Cobre os 3 pilares (logs estruturados em JSON, métricas RED via OpenTelemetry/Prometheus, distributed tracing), definição de SLIs/SLOs/Error Budgets e alertas acionáveis."
---

# Observability, Telemetry & SLO Engineering

> **Propósito:** Transformar a observabilidade de um mero repositório de logs em um **motor ativo de telemetria e confiabilidade**, permitindo diagnosticar incidentes em segundos, correlacionar requisições distribuídas e disparar alertas acionáveis baseados em SLOs e consumo de Error Budget.

---

## 1. Os 3 Pilares da Observabilidade

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Logs Estruturados (JSON + Correlation ID)               │
│    Contexto rico, rastreável e indexável                     │
├─────────────────────────────────────────────────────────────┤
│ 2. Métricas RED (Rate, Errors, Duration)                    │
│    Telemetria em tempo real via OpenTelemetry e Prometheus  │
├─────────────────────────────────────────────────────────────┤
│ 3. Distributed Tracing (OpenTelemetry)                      │
│    Grafo visual de latência e chamadas entre serviços       │
└─────────────────────────────────────────────────────────────┘
```

---

### 1.A Logs Estruturados em JSON
- **Regra:** Todo log de aplicação em produção deve ser emitido como um objeto JSON em linha única no `stdout`.
- **Campos Obrigatórios:**
  ```json
  {
    "timestamp": "2026-08-28T16:10:00.123Z",
    "level": "INFO",
    "service": "billing-service",
    "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
    "span_id": "00f067aa0ba902b7",
    "correlation_id": "req-987654321",
    "user_id": "usr-12345",
    "message": "Payment processed successfully",
    "duration_ms": 142.5
  }
  ```
- **Segurança de PII:** Nunca registre dados sensíveis (senhas, tokens JWT, números de cartão ou dados pessoais sensíveis) nos logs.

---

### 1.B Métricas de Aplicação: O Padrão RED
Para todos os serviços e endpoints HTTP/gRPC, colete as três métricas essenciais:
1. **Rate (Taxa):** Número de requisições por segundo (`http_requests_total`).
2. **Errors (Erros):** Número de requisições que falharam com HTTP 5xx (`http_requests_errors_total`).
3. **Duration (Duração):** Distribuição de latência e tempos de resposta em percentis p50, p90, p95 e p99 (`http_request_duration_seconds_bucket`).

---

### 1.C Distributed Tracing (Rastreamento Distribuído)
- **OpenTelemetry Standard:** Propague o cabeçalho `traceparent` (W3C Trace Context) em todas as chamadas HTTP e mensagens assíncronas (Kafka, RabbitMQ, SQS).
- **Spans em Operações Críticas:** Crie spans dedicados para consultas de banco de dados, chamadas a APIs externas e operações pesadas de I/O para identificar gargalos imediatamente.

---

## 2. Engenharia de SLIs, SLOs & Error Budgets

```text
SLI (O que é medido) → SLO (A meta combinada) → Error Budget (A margem permitida de falha)
```

1. **Service Level Indicator (SLI):**
   - *Exemplo de Disponibilidade:* `Requisições HTTP bem-sucedidas (não-5xx) / Total de requisições válidas`.
   - *Exemplo de Latência:* `Requisições atendidas em menos de 200ms / Total de requisições`.
2. **Service Level Objective (SLO):**
   - *Meta:* `99.9% de disponibilidade no período de 30 dias` (permite até ~43 minutos de indisponibilidade por mês).
   - *Meta de Latência:* `95% das requisições com latência inferior a 250ms`.
3. **Error Budget (Orçamento de Erro):**
   - A margem de erro aceitável (`100% - 99.9% = 0.1%`).
   - Se o consumo do Error Budget for acelerado (ex: queimar 50% do orçamento em 1 hora), **novos deploys de features devem ser congelados** para priorizar a estabilização e confiabilidade do sistema.

---

## 3. Alertas Acionáveis (*Actionable Alerting*)

- **Regra de Ouro:** Alertas que acionam plantonistas (PagerDuty, Slack) devem indicar **SINTOMAS REAIS QUE IMPACTAM O USUÁRIO**, não causas internas transitórias.
- Alerte em:
  - Consumo acelerado do Error Budget (*Multi-window multi-burn-rate alerts*).
  - Taxa de erro 5xx elevada ou picos anômalos de latência p99.
- Não envie alertas de alta prioridade para uso de CPU pontual se o SLO e o tempo de resposta continuam saudáveis.
