---
name: tdd-safety-net
description: "Garante a aplicação estrita do ciclo RED-GREEN-REFACTOR baseada em cobertura de comportamento e não em volume de linhas."
---

# TDD Safety Net

O desenvolvimento é orientado a testes (Red → Green → Refactor).

## Diretrizes Fundamentais
1. **Nunca implemente antes do RED**: Exceto para spikes descartáveis, nenhuma lógica de negócio é escrita antes do teste que a comprova.
2. **Cobertura de Comportamento**: Avalie a qualidade dos testes por *behavior coverage*, *critical path coverage* e validação de contratos/limites. **Nunca use métricas arbitrárias como quantidade de linhas de teste**. Mais testes não significa melhores testes.
3. **Piratâmide de Testes**: Aplique testes na camada correta (Unit para lógica, Integration para fronteiras, E2E para fluxos de negócio críticos).
4. Em caso de bugs (Bugfix Flow), o teste de regressão (RED) deve provar a existência do erro antes da correção.
