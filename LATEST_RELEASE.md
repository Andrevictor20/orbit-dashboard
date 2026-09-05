# Orbit Dashboard v2.4.0

### 🚀 Novidades & Recursos Principais (v2.4.0)

- **Consolidação de Dispositivos no Home Assistant:**
  - **Agrupamento Inteligente por Hardware:** As entidades soltas (Tapo, tomadas, lâmpadas, etc.) são agora agrupadas no dispositivo físico correspondente via `groupAllDevices` em `haUtils.ts`, eliminando a listagem de 200+ entidades individuais.
  - **Navegação por Áreas Dinâmicas:** As áreas exibidas no dashboard são fornecidas diretamente pelo Home Assistant via template Jinja2 (campo `area` injetado no backend `homeassistant.rs`), sem hardcoding no frontend.
  - **Remoção de Abas Fixas:** Eliminadas as abas estáticas "Sala" e "Quartos" de `HomeAssistant.tsx`. A navegação agora é 100% dinâmica com base nas áreas reais cadastradas no Home Assistant.
  - **Proteção contra Dupla Renderização:** Mecanismo de `Set<string> consumed` garante que cada entidade apareça em apenas um dispositivo, sem duplicação.
  - **Filtros por `device_class`:** Sensores de clima, porta e movimento não são consumidos por lâmpadas/switches, mantendo a hierarquia correta.

- **Backend:**
  - Injeção de metadados `area` e `device_name` via template Jinja2 no `homeassistant.rs`.
  - Cache seguro de configuração via `HA_CONFIG_CACHE` com `RwLock`.

- **Testes:**
  - 6 testes de agrupamento em `DeviceGrouping.test.tsx` validando consolidação de Tapo, tomadas, TVs, roteador e sistema.
  - 3 testes de página em `HomeAssistant.test.tsx` cobrindo renderização de áreas e fallback.

---

### Versões Anteriores

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
