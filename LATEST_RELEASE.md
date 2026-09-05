# Orbit Dashboard v2.5.0

### 🚀 Novidades & Recursos Principais (v2.5.0)

- **Detecção Inteligente de Interface Primária & Telemetria em Tempo Real:**
  - **Identificação da Rota Padrão do Host:** Detecção automática da interface primária de saída de internet através da tabela de rotas do host (`/host/proc/1/net/route` e `/proc/1/net/route`) com seleção por menor métrica e exclusão de bridges virtuais (`lo`, `docker*`, `veth*`, `tailscale*`).
  - **Parser Resiliente de Estatísticas de Rede:** Extração de bytes em `/host/proc/1/net/dev` blindada contra colisão de contadores com o separador `:` via `split_once(':')`.
  - **Classificação Automática de Conexão (Cabo / Wi-Fi):** Identificação do tipo físico da interface (`ethernet` ou `wifi`) com badges e ícones semânticos dinâmicos no card de Tráfego de Rede da Visão Geral e no cabeçalho de Métricas.
  - **Formatação Adaptativa de Velocidade:** Novo formatador `formatNetworkSpeed` dinâmico (`B/s`, `KB/s`, `MB/s`, `GB/s`), eliminando o congelamento visual em `0.0 MB` no dashboard.

- **Modularização & Arquitetura Domain-Driven (No God Files):**
  - **Backend (Rust):** Desacoplamento de `containers.rs` (-72% linhas) nos submódulos especializados `port_prioritization.rs`, `updates.rs` e `update_runner.rs`.
  - **Backend (Rust):** Extração da telemetria e parser de interfaces de rede de `ws.rs` para o módulo dedicado `system/network.rs`.
  - **Frontend (React/TS):** Modularização de `ContainerList.tsx` (-61% linhas) no pacote de domínio `components/docker/container-list/` (`StackGridCard`, `ContainerGridCard`, `ContainerTableView`, `CustomLinkModal`, `PrimaryContainerModal`).
  - **Frontend (React/TS):** Modularização de `FileManager.tsx` (-50% linhas) no pacote de domínio `components/files/` (`FileSidebar`, `FileToolbar`, `FileBreadcrumbs`, `FileGridView`, `FileTableView`, `FileTrashView`, `FileBadgeVisual`).

- **Acessibilidade Universal & Calibração de Contraste WCAG AA:**
  - **Design Tokens:** Token `--secondary` em temas claros recalibrado de `#64748b` para `#475569`, elevando a taxa de contraste sobre superfícies brancas para 7.58:1 (WCAG AA).
  - **Remediação de Modais e Cards Cinzas:** Correção exaustiva em 18 modais e dezenas de cards/tabelas cinzas no tema claro, eliminando textos invisíveis (`bg-accent text-white`), textos apagados (`text-zinc-300`, `text-zinc-400`, `text-*-400`) e fundos escuros hardcoded.
  - **Padrão Two-Tier Contrast:** Badges de status, contadores e tabelas utilizam cores em dois níveis (`text-{color}-700 dark:text-{color}-300`), preservando integralmente o design Liquid Glass no modo escuro.

---

### Versões Anteriores

<details>
<summary>v2.4.0 — Home Assistant Device Grouping & Dynamic Areas</summary>

- **Consolidação de Dispositivos no Home Assistant:**
  - Agrupamento inteligente por hardware físico via `groupAllDevices`, eliminando a listagem de 200+ entidades soltas.
  - Navegação 100% dinâmica por áreas extraídas do Home Assistant via template Jinja2 no backend (`homeassistant.rs`).
  - Remoção de abas estáticas ("Sala", "Quartos") e proteção contra dupla renderização via `consumed` set.
  - Filtros por `device_class` protegendo lâmpadas e switches de absorver sensores climáticos ou de presença.

</details>

<details>
<summary>v2.3.0 — Home Assistant Device Grouping & Async Batch Updates</summary>

- **Agrupamento Universal de Entidades do Home Assistant & Inspeção Interativa por Modal**
- **Desacoplamento Assíncrono do Atualizador de Containers (Fim dos Timeouts 524)**

</details>

<details>
<summary>v2.2.0 — Home Assistant Integration & Liquid Glass</summary>

- Integração inicial com Home Assistant
- Cards em Liquid Glass
- Otimização de memória e telemetria multi-disco

</details>

<details>
<summary>v2.1.0 — Port Prioritization & Background Updates</summary>

- Priorização de portas
- Atualizações em background
- Automação de semver

</details>
