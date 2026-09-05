# Orbit Dashboard v2.6.0

### Novidades e Recursos Principais (v2.6.0)

- **Telemetria Completa de Rede do Host nos Gráficos:**
  - **Curvas de Tráfego do Host:** Inclusão das séries temporais de Download (`Host Download`) e Upload (`Host Upload`) no gráfico de área do painel de métricas, permitindo monitoramento completo da máquina física além dos contêineres Docker.
  - **Filtros Segmentados por Abas:** Alternância ágil entre a visão unificada (Host e Contêineres), foco exclusivo na interface física do host ou foco exclusivo nos contêineres gerenciados.
  - **Velocidades em Tempo Real:** Indicadores instantâneos de taxa de download (↓) e upload (↑) no cabeçalho do card com formatação dinâmica adaptativa (B/s, KB/s, MB/s).

- **Ergonomia e Navegação Aprimorada em Dispositivos Móveis:**
  - **Menu Unificado de Preferências:** Em telas menores que 640px, os seletores independentes de paleta e idioma foram consolidados em um único botão táctil de preferências com popover em vidro fosco.
  - **Alvos de Toque Padronizados (WCAG AA):** Botões da barra superior calibrados para dimensões mínimas de 36x36px com espaçamento central preservado para operação confortável com uma mão.
  - **Ocultação de Controles Redundantes:** Otimização do espaço visual em smartphones com ocultação automática de controles gerenciados nativamente pelos navegadores móveis.

- **Resolução Resiliente de Memória RAM em Ambientes Homelab:**
  - **Fallback Automático de Cgroups:** Caso a distribuição Linux (ex.: Raspberry Pi OS, CasaOS, Armbian ou containers LXC) esteja com a contabilidade de memória em cgroups desabilitada no kernel, o sistema aciona automaticamente a amostragem de processos via RSS, impedindo que o indicador de memória dos contêineres fique congelado em 0.0 MB.
  - **Teto Físico de Memória:** Adoção determinística da memória total do host quando os limites de contêiner forem ilimitados.

- **Otimizações Gerais de Desempenho e Eficiência:**
  - **Telemetria em Alta Frequência:** Redução drástica de alocações e clonagens de memória no loop de transmissão WebSocket e no monitor de processos.
  - **Renderização Fluida de Gráficos:** Memoização de mini gráficos SVG e limite no anel de histórico em memória para navegação suave mesmo em hardware compacto.

- **Hardening de Segurança e Conformidade Local:**
  - **Isolamento de Logs:** Rotas de visualização e limpeza de logs do sistema protegidas por autenticação obrigatória.
  - **Proteção contra IDOR de Processos:** Bloqueio mandatório contra encerramento acidental do próprio processo do Orbit, PID 1 e daemons vitais do sistema operacional.
  - **CORS Dinâmico Local:** Aceitação controlada de requisições de sub-redes privadas RFC 1918, domínios mDNS, Tailscale e túneis Cloudflare, rejeitando origens públicas arbitrárias.

- **Documentação Técnica Completa:**
  - Manuais de arquitetura, instalação com exemplos de proxies reversos (Nginx e Caddy), políticas de segurança e estratégia de testes totalmente reformulados com especificações técnicas detalhadas.

---

### Versões Anteriores

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
