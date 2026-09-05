# Orbit Dashboard v2.5.3

### 🚀 Novidades & Recursos Principais (v2.5.3)

- **Correção da Telemetria de Memória RAM nos Containers:**
  - **Cálculo Preciso de Memória Utilizada:** Adequação ao padrão oficial da Docker Engine para Linux e cgroups (v1 e v2), evitando que páginas de cache e buffers zerem indevidamente a contagem e garantindo que o consumo real de cada container seja exibido dinamicamente em MB ou GB, em vez de permanecer congelado em 0.0 MB.
  - **Sincronização de Telemetria:** Sincronização e pareamento confiável de snapshots de recursos entre todos os containers individuais e stacks.

- **Contabilização Real de Uso de Disco (Armazenamento dos Containers):**
  - **Métricas Reais de Armazenamento:** Contabilização precisa do tamanho virtual e da camada de leitura/escrita dos containers e stacks, eliminando a exibição incorreta de 0 B.
  - **Cache Assíncrono de Baixo Impacto:** Coleta e atualização em segundo plano do tamanho dos containers no Docker daemon, garantindo que o inventário carregue instantaneamente mesmo em servidores com discos mais lentos como cartões microSD ou HDs mecânicos.

- **Concorrência Otimizada e Prevenção de Timeouts:**
  - **Consumo Inteligente de Recursos no Host:** Controle de concorrência na leitura de métricas do Docker Socket, evitando sobrecarga em dispositivos compactos como Raspberry Pi com dezenas de containers simultâneos.

---

### Versões Anteriores

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
