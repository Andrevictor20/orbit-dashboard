# Orbit Dashboard v2.5.4

### 🚀 Novidades & Recursos Principais (v2.5.4)

- **Detecção & Exibição Precisa de Atualizações de Imagens de Containers:**
  - **Suporte Completo a Stacks:** Identificação e contagem automática de containers desatualizados dentro de stacks, exibindo badge violeta interativo de atualização (`Atualizar (N)`) no cabeçalho dos cards e contagem no botão de sub-containers.
  - **Atualização Direta de Sub-containers:** No modal detalhado da stack, cada serviço com nova versão da imagem disponível conta agora com botão direto de atualização.
  - **Checagem Concorrente de Baixíssima Latência:** Paralelização das consultas a registros de imagem (Docker Hub, GHCR, etc.) com concorrência limitada (`buffer_unordered(8)`) e deduplicação de imagens, reduzindo o tempo de varredura de ~60 segundos para menos de 2 segundos.
  - **Lookup Resiliente de IDs:** Indexação dupla (short ID de 12 caracteres e ID completo de 64 caracteres), eliminando falhas de correspondência no frontend.
  - **Compatibilidade Ampliada com Registries & Pinned Digests:** Tratamento inteligente de tags com hash (`@sha256:`), suporte a imagens do ecossistema LinuxServer (`lscr.io`) e desafio Bearer dinâmico para registries compatíveis com OCI/Docker v2.
  - **Autenticação Flexível:** Middleware de autenticação no backend passa a aceitar tanto cookies quanto o cabeçalho `Authorization: Bearer <token>`.

- **Redesign & Descongestionamento do Home Assistant:**
  - **Layout Elegante em 2 Níveis:** Eliminação de faixas horizontais empilhadas, trazendo visual fluido inspirado no Apple Home e Lovelace Mushroom UI.
  - **Top Bar com Status Chips Interativos:** Contadores rápidos de luzes, tomadas e sensores que filtram a interface instantaneamente com 1 toque.
  - **Dropdown de Áreas Dinâmicas & Subfiltros:** Menu compacto de áreas (`[ 📍 Todas as Áreas (N) ▾ ]`) e barra de subcategorias com ícones dedicados e busca integrada.
  - **Cards Tile/Mushroom:** Cards ~35% mais compactos com visual limpo, brilho adaptativo nos dispositivos ligados e eliminação de caixas de texto redundantes.

---

### Versões Anteriores

<details>
<summary>v2.5.3 — Telemetria de RAM, Armazenamento Real & Prevenção de Timeouts</summary>

- Correção do cálculo de RAM conforme padrão oficial da Docker Engine
- Contabilização real de uso de disco (armazenamento virtual e RW)
- Concorrência otimizada e prevenção de sobrecarga em hosts compactos

</details>

<details>
<summary>v2.5.2 — Acessibilidade, Tema Claro & Streaming de Atualização</summary>

- Acessibilidade & Correção Definitiva de Contraste no Tema Claro
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
- Acessibilidade & Alto Contraste

</details>

<details>
<summary>v2.4.0 — Home Assistant Device Grouping & Dynamic Areas</summary>

- Consolidação de Dispositivos no Home Assistant
- Agrupamento inteligente por hardware físico
- Navegação 100% dinâmica por áreas extraídas do Home Assistant

</details>

<details>
<summary>v2.3.0 — Home Assistant Device Grouping & Async Batch Updates</summary>

- Agrupamento Universal de Entidades do Home Assistant & Inspeção Interativa por Modal
- Desacoplamento Assíncrono do Atualizador de Containers (Fim dos Timeouts 524)

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
