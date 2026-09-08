# Orbit Dashboard v2.7.1

### Novidades e Recursos Principais (v2.7.0)

- **Watchdog Inteligente e Resiliência em Atualizações em Lote:**
  - **Eliminação de Falsos Timeouts:** Atualizações de imagens volumosas (como n8n, Ollama, Nextcloud e Home Assistant) agora contam com monitoramento baseado em atividade real, evitando interrupções prematuras enquanto dados continuam sendo descompactados e baixados.
  - **Execução Serial Segura:** Prevenção contra sobrecarga de disco e contenção no Docker daemon, garantindo que cada contêiner conclua seu ciclo antes de iniciar o próximo.
  - **Tolerância a Oscilações de Rede:** Buffer resiliente de até 90 segundos para absorver quedas temporárias de proxies, túneis Cloudflare ou saturação de banda.

- **Limpeza Automática de Imagens Antigas do Orbit:**
  - **Liberação Automática de Armazenamento:** Ao confirmar e concluir a atualização do próprio Orbit, as imagens anteriores e camadas desvinculadas são automaticamente identificadas e removidas do disco, sem necessidade de faxina manual.
  - **Proteção contra Órfãos:** Higienização executada tanto pelo processo de atualização quanto na inicialização do novo contêiner.

- **Persistência Anti-F5 e Recuperação de Sessão:**
  - **Recuperação Imediata:** Atualizações em lote, downloads de aplicativos da loja e operações longas são preservadas localmente e continuam automaticamente mesmo se a aba do navegador for atualizada (F5) ou a conexão oscilar.

- **Otimização Extrema de Desempenho no Home Assistant:**
  - **Redução de Carga no Host:** Sistema de particionamento e cache inteligente em dois níveis reduz em mais de 90% a sobrecarga de CPU sobre o servidor do Home Assistant, mantendo dispositivos e entidades perfeitamente responsivos.

- **Identidade Visual Adaptativa:**
  - **Favicon Dinâmico:** O ícone da aba do navegador agora sincroniza dinamicamente com a paleta de cores e o tema ativo (claro ou escuro).

---

### Versões Anteriores

<details>
<summary>v2.6.0 — Telemetria de Rede do Host, Ergonomia Mobile & Fallback de RAM</summary>

- Telemetria completa de rede do host nos gráficos com curvas de download e upload
- Filtros segmentados por abas (Host, Contêineres ou Unificado)
- Menu unificado de preferências em telas móveis com alvos de toque WCAG AA
- Fallback automático de cgroups via amostragem RSS para memória em homelab
- Otimizações de desempenho e hardening de segurança com CORS dinâmico local

</details>

<details>
<summary>v2.5.5 — Otimização de CI/CD e Estabilidade em Runners Headless</summary>

- Extensão de timeouts para 60s e 90s nos testes E2E do Playwright no GitHub Actions
- Eliminação de timeouts intermitentes no runner WebKit
- Execução com 100% de aprovação em SAST, E2E e OWASP ZAP DAST

</details>

<details>
<summary>v2.5.4 — Hardening de Segurança Homelab & Remoção Multi-Cloud</summary>

- Remoção de integrações multi-cloud externas e credenciais legadas
- Proteção estrita de rotas administrativas e mitigação de auto-kill de processos
- Segredos JWT gerados via CSPRNG de 64 bytes

</details>

<details>
<summary>v2.5.3 — Telemetria de RAM, Armazenamento Real & Prevenção de Timeouts</summary>

- Correção do cálculo de RAM conforme padrão oficial da Docker Engine
- Contabilização real de uso de disco (armazenamento virtual e RW)
- Concorrência otimizada e prevenção de sobrecarga em hosts compactos

</details>

<details>
<summary>v2.5.2 — Acessibilidade, Tema Claro & Streaming de Atualização</summary>

- Acessibilidade & Correção Definitiva de Contraste no Tema Claro via `@custom-variant dark`
- Atualizador de Containers em Tempo Real & Anti-Travamento
- Telemetria Inteligente de Rede (Cabo / Wi-Fi)

</details>

<details>
<summary>v2.5.1 — Container Streaming & Light Theme Polish</summary>

- Streaming contínuo de download de imagens Docker
- Cancelamento em tempo real de tarefas no host
- Atualização das notas de versão

</details>

<details>
<summary>v2.5.0 — Network Telemetry, Domain Architecture & Contrast</summary>

- Detecção Inteligente de Rede & Telemetria em Tempo Real
- Atualizador de Containers Resiliente
- Acessibilidade & Alto Contraste WCAG AA

</details>

<details>
<summary>v2.4.0 — Home Assistant Device Grouping & Dynamic Areas</summary>

- Consolidação de Dispositivos no Home Assistant
- Agrupamento inteligente por hardware físico
- Navegação dinâmica por áreas extraídas do Home Assistant

</details>

<details>
<summary>v2.3.0 — Home Assistant Device Grouping & Async Batch Updates</summary>

- Agrupamento Universal de Entidades do Home Assistant & Inspeção Interativa por Modal
- Desacoplamento Assíncrono do Atualizador de Containers

</details>

<details>
<summary>v2.2.0 — Home Assistant Integration & Liquid Glass</summary>

- Integração com Home Assistant
- Cards em Liquid Glass
- Otimização de memória e telemetria multi-disco

</details>

<details>
<summary>v2.1.0 — Port Prioritization & Background Updates</summary>

- Priorização de portas
- Atualizações em background
- Automação de semver

</details>
