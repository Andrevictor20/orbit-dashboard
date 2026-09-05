# Orbit Dashboard v2.5.2

### 🚀 Novidades & Recursos Principais (v2.5.2)

- **Acessibilidade & Correção Definitiva de Contraste no Tema Claro:**
  - **Legibilidade Total de Textos e Modais:** Corrigida a compatibilidade com navegadores e sistemas operacionais com preferência escura ativa, garantindo que o tema claro exiba textos em preto/grafite sólido de altíssimo contraste (WCAG AA > 15:1) em vez de tons claros ou esbranquiçados.
  - **Notas de Atualização Nítidas:** Títulos, subtítulos e descrições das melhorias do sistema agora contam com contraste profundo e fundo perfeitamente legível.

- **Atualizador de Containers em Tempo Real & Anti-Travamento:**
  - **Streaming Contínuo de Download:** O console de atualização agora exibe em tempo real o progresso de cada camada sendo baixada do Docker Hub ou Compose (incluindo contagem de MBs e porcentagem), eliminando a sensação de travamento durante o download de imagens pesadas como o Home Assistant.
  - **Cancelamento Imediato de Processos:** Botões para cancelar containers individuais ou toda a fila de atualização encerram os processos no host instantaneamente, liberando a fila sem locks pendentes.
  - **Recuperação e Reinício Rápido:** Tarefas antigas são expiradas automaticamente e o sistema permite reiniciar downloads travados sem erro de concorrência ou falsos-positivos.

- **Telemetria Inteligente de Rede (Cabo / Wi-Fi):**
  - **Detecção Automática de Interface:** Identificação automática do tipo de conexão ativa do servidor com ícones dinâmicos no card de Tráfego de Rede da Visão Geral e no cabeçalho de Métricas.
  - **Velocidade Adaptativa em Tempo Real:** Formatação inteligente e dinâmica de velocidade (B/s, KB/s, MB/s, GB/s), eliminando números congelados em 0.0 MB.

---

### Versões Anteriores

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
