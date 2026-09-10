# Orbit Dashboard v3.1.1

### Novidades e Recursos Principais (v3.1.1)

- **Integração Nativa e Direta com Cloudflare Tunnels:**
  - **Auto-Descoberta de Instâncias:** Detecção automática de contêineres `cloudflared` em execução no Docker host e auto-carregamento de tokens e credenciais.
  - **Mapeamento de Rotas e Túneis:** Leitura transparente da API do Cloudflare Zero Trust (`api.cloudflare.com/client/v4/accounts/.../cfd_tunnel`) listando túneis ativos, status de conexão (`healthy`/`degraded`/`down`) e rotas públicas configuradas (CNAMEs / Hostnames).
  - **Preenchimento Automático em 1 Clique:** Sugestão e aplicação instantânea de domínios públicos HTTPS seguros aos aplicativos e contêineres detectados no Dashboard.
  - **Aba Dedicada de Gerenciamento:** Nova seção Cloudflare no menu lateral com visão completa de túneis, métricas de conectividade e atalhos de reconexão.

- **Blindagem do Atualizador Automático & Correção de Transição de Versão:**
  - **Auto-Identificação de Contêiner via HOSTNAME:** O motor de atualização agora detecta o ID e nome exato do contêiner Orbit ativo, independentemente de diferenças de nomenclatura (`Orbit`, `orbit`, `orbit-dashboard`, `orbit-orbit-1` ou CasaOS).
  - **Resolução Definitiva de Conflito de Portas (5172/5173):** Liberação forçada do socket e finalização garantida da instância anterior antes da inicialização do novo contêiner, eliminando falhas de deploy onde a versão anterior permanecia ativa.
  - **Eliminação de Contêineres Órfãos (Fim do "1/2 ativos"):** Limpeza automática no startup e durante o ciclo de atualização de contêineres em estados `created`, `exited` ou `dead`.
  - **Fallback Bidirecional com Docker Compose & Engine:** Atualização dinâmica de tags em arquivos Compose existentes e fallback automático com preservação estrita do volume de dados (`orbit_data`).
  - **Suporte Total a Plugins Compose:** Disponibilização de symlinks e binários para `docker compose` e `docker-compose` dentro do contêiner temporário de deploy.

---

### Versões Anteriores

<details>
<summary>v3.1.0 — Auto-Healing de Volumes, QHD Wallpapers, Scroll Fixes & Pi-hole v6</summary>

- **Blindagem de Persistência e Auto-Healing de Volumes em Atualizações:**
  - **Zero Perda de Dados:** Preservação estrita e determinística de senhas de acesso (`orbit_auth.json`), links customizados de containers (`custom_links.json`), configurações de rede, integrações e compartilhamentos SMB em qualquer atualização in-place.
  - **Módulo de Auto-Recuperação no Boot:** Varredura automática em volumes Docker e caminhos do host (`data_migrator.rs`) que recupera credenciais e configurações caso o volume tenha sido desconectado em atualizações anteriores.
  - **Inspeção Dinâmica de Montagens:** O atualizador agora identifica com precisão o volume nomeado ou bind-mount ativo do container antes de realizar o deploy da nova versão.

- **Suporte Híbrido ao Pi-hole v6 (REST API FTL) & v5 (PHP API Legada):**
  - **Compatibilidade Nativa Pi-hole v6:** Suporte total à nova API REST FTL do Pi-hole v6.0+ via Session ID (`X-FTL-SID`) e App Passwords.
  - **Detecção e Fallback Transparentes:** Alternância automática entre as APIs v6 e v5 dependendo da versão do servidor de destino, sem requerer reconfiguração manual.

- **Fidelidade Visual e Qualidade Ultra-HD para Wallpapers:**
  - **Upload em Alta Resolução (QHD):** Processamento de imagens de plano de fundo em até 2560px com suavização de alta fidelidade e codificação WebP a 92% de qualidade fotográfica.
  - **Preservação de Cores e Atmosfera:** Ajuste dinâmico das luzes ambientais para evitar halos coloridos sobre o papel de parede e compensação de bordas em caso de desfoque.
  - **Desfoque Padrão Nítido:** Papéis de parede agora são exibidos 100% nítidos por padrão (blur 0px), com controle total do dimmer de opacidade de 0% a 95%.

- **Ergonomia de Layout, Scroll e Acessibilidade:**
  - **Scroll-To-Top em Transições de Página:** Resolução do bug de herança de rolagem no React Router, garantindo que títulos, ferramentas e barras de ação sempre apareçam visíveis no topo ao abrir qualquer tela.
  - **Aba de Configurações Sem Barra de Scroll:** Eliminação da barra de rolagem horizontal nativa nas abas do modal de configurações com expansão para `max-w-2xl` e utilitários de rolagem invisível.
  - **Localização Customizada do Clima:** Definição manual da cidade no Card de Previsão do Tempo (Open-Meteo) com opção de restauração automática por geolocalização IP em 1 clique.

</details>

<details>
<summary>v3.0.0 — Pi-hole DNS Guard, Central "Minha Conta", Compose YAML & Backups</summary>

- **Integração Nativa com Pi-hole:** Monitoramento de telemetria de consultas DNS, controle de bloqueio temporizado e gestão completa de Allowlist/Blocklist.
- **Central de Configurações & Perfil Unificada:** Gestão reativa de integrações, customização da porta web com verificação de socket no host, temas e avatares personalizados.
- **App Store & Docker Compose:** Customização pré-deploy na App Store, editor integrado de Docker Compose YAML com sintaxe destacada e backups 1-clique compactados (.tar.gz).
- **Gerenciador de Arquivos & Multimídia:** Compartilhamento Samba (SMB), uploads particionados em chunks resilientes e player de vídeo acelerado por GPU com legendas externas.

</details>

<details>
<summary>v2.7.5 — Estabilidade, Transição Segura & Watchdog de Containers</summary>

- **Eliminação de Falsos-Positivos de Atualização:** Comparação SemVer rigorosa (`major.minor.patch`) e imunidade a divergências de digest multi-arch (ARM64/AMD64).
- **Prevenção de Conflitos de Porta:** Transição limpa e encerramento de contêineres órfãos no startup e sob demanda.
- **Recarregamento Suave e Sessão Preservada:** Healthcheck inteligente antes de concluir a etapa de atualização sem deslogar o usuário.
- **Watchdog Inteligente em Lote:** Execução serial segura e monitoramento de atividade real em imagens volumosas.
- **Limpeza Automática:** Liberação automática de armazenamento removendo camadas e imagens antigas do Orbit.
- **Identidade Visual Adaptativa:** Favicon dinâmico sincronizado com o tema ativo.

</details>

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
