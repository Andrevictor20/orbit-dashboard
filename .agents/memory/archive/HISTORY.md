# 📜 Arquivo Histórico de Entregas e Versões Anteriores

Este arquivo armazena as entregas, alterações e decisões que foram podadas do `.agents/memory/PROJECT_MEMORY.md` para manter a memória ativa dentro do orçamento de tokens (Sliding Window).

---

## Histórico Consolidado de Versões

### [v2.8.0] - Resource Optimization & Master Performance Release (2026-08-28)
- **Backend Singleton Stats Broadcaster**: Substituição do polling por conexão WebSocket por um único coletor centralizado com broadcast atômico `Arc<String>` via `tokio::sync::broadcast` ($O(1)$ de escala em CPU/RAM).
- **Adaptive Sleep**: Polling ajustado para 8s em idle (sem conexões) e 3s ativo para poupar ciclos no Raspberry Pi.
- **Frontend Lazy Route Splitting**: Implementação de `React.lazy` + `Suspense` em todas as 14 rotas do Orbit.
- **Rollup manualChunks**: Divisão de `recharts`, `xterm` e ícones no Vite, reduzindo o bundle principal de **1.31 MB para 318 KB** (~75% de redução).
- **Dockerfile & Binary Slimming**: Perfil de release Rust com LTO, `codegen-units = 1`, `panic = "abort"` e `strip = true`; `--no-install-recommends` no Debian reduzindo a imagem de **314 MB para < 95 MB**.

---

### [v2.7.0] - Multi-Arch Self-Update & Changelog Modal Release (2026-08-28)
- **Atualização Sob Demanda**: Endpoints `GET /api/system/update/check` e `POST /api/system/update` com detecção automática de arquitetura (`linux/arm64` vs `linux/amd64`).
- **Update Modal com Changelog**: Componente `UpdateModal.tsx` com visualização de notas de versão do GitHub, tag de arquitetura e progresso de atualização em tempo real.
- **Notificação Topbar**: Botão animado com badge de notificação no layout para avisar sobre novas versões.
- **Remoção do Watchtower**: Atualizações passam a ser 100% integradas e sob controle do usuário.
- **Correções de Hoisting**: Ajustada ordem de declaração de funções e hooks no `FileManager.tsx`.

---

### [v2.6.0] - Log Rotation, Vacuum & Storage Reclaim (2026-08-28)
- **Recuperação de 10GB no Host**:
  - Limite de logs JSON no Docker daemon (10m, 3 arquivos).
  - Limite e vacuum de 50MB no `systemd-journald`.
  - Truncamento ativo (`shrink_active_log_file`) liberando 4.25GB no volume `orbit_data`.
  - Endpoint `POST /api/docker/builder/prune` e botão na UI para liberar 5.98GB de cache BuildKit.
- **Leitura Reversa Bounded**: Leitura de logs via buffer reverso $O(N)$ em RAM sem carregar arquivos inteiros na memória.

---

### [v2.5.0] - Conversion Copywriting, CRO & Marketing Psychology (2026-08-28)
- Integração de 5 novas skills: `conversion-copywriting`, `cro-landing-pages`, `seo-content-engine`, `marketing-psychology` e `copy-editing-sweeps`.
- Adição de modelos mentais de conversão, ancoragem, eliminação de jargões e otimização para AI Search / GEO (Google AI Overviews, Perplexity).

---

### [v2.4.0] - 4-Tier Continuous Memory & Structured Handoffs (2026-08-28)
- Implementação da arquitetura de 4 Tiers de memória (Working, Episodic, Semantic, Procedural).
- Criação do agente `archivist` para sincronização ao final de tarefas e manutenção de `archive/HISTORY.md`.
- Fast Context Bootstrap no início de sessões via `PROJECT_MEMORY.md`.

---

### [v2.3.0] - Root Cause Engineering & Code Deslop (2026-08-28)
- Integração de `systematic-debugging`, `no-workarounds`, `code-deslop-review` e `lesson-learned`.
- Proibição inegociável de supressões de compilador/linter e regra dos 3 fixes.

---

### [v2.2.0] - DevOps Zero-Downtime, IaC & Zero Trust CloudSec (2026-08-28)
- Suíte completa de deploy sem indisponibilidade (Blue/Green, Canary), governança de IaC, observabilidade RED e autenticação federada via OIDC.

---

### [v2.1.0] - Strict TDD Multi-Layer Matrix & Anti-Test-Bypass Policy (2026-08-28)
- Matriz de testes de 8 camadas (Unitário, Integração, Contrato, Regressão, E2E, Fuzzing, Segurança, Performance).
- Política Anti-Test-Bypass com proibição de mocks cegos, skips e asserções fakes.

---

### [v2.0.0] - Agnostic Multi-Agent Framework Core (2026-08-28)
- Migração completa para arquitetura modular em `.agents/` (agents, skills, workflows, policies, templates).
- Task Routing adaptativo L0-L3 com TDD nativo.
