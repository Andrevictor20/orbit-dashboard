# Orbit Dashboard v2.5.0

### 🚀 Novidades & Recursos Principais (v2.5.0)

- **Detecção Inteligente de Rede & Telemetria em Tempo Real:**
  - **Identificação Automática de Conexão (Cabo / Wi-Fi):** O sistema agora detecta e identifica automaticamente se o seu servidor está conectado via cabo de rede ethernet ou Wi-Fi, exibindo o ícone e nome da interface ativa no card de Tráfego de Rede da Visão Geral e no cabeçalho de Métricas.
  - **Velocidade de Rede Adaptativa e Dinâmica:** Novo formato inteligente de exibição de velocidade (B/s, KB/s, MB/s, GB/s), eliminando números estáticos e exibindo em tempo real o consumo real de download e upload da sua rede.

- **Atualizador de Containers Resiliente:**
  - **Logs e Progresso de Download em Tempo Real:** O console de atualização agora transmite ao vivo cada camada sendo baixada e extraída do Docker Hub e Docker Compose, eliminando a sensação de travamento durante o download de imagens pesadas (como Home Assistant).
  - **Cancelamento Rápido e Seguro:** Possibilidade de cancelar processos em lote ou containers individuais imediatamente, liberando o sistema para novas tentativas sem bloqueios.
  - **Recuperação Automática de Falhas:** Timeout e fallback resiliente que evitam congelamentos caso o download demore ou haja interrupção temporária de conexão.

- **Acessibilidade & Alto Contraste:**
  - **Contraste Calibrado (Padrão WCAG AA):** Ajuste em todos os temas claros garantindo legibilidade perfeita de textos, tabelas, métricas e modais sem textos apagados ou cinzas difíceis de visualizar.
  - **Leitura Impecável de Telas e Modais:** Reforço de contraste nos modais de atualização do sistema, conexões de nuvem, detalhes de containers e dispositivos inteligentes.

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
