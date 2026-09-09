# Orbit Dashboard v3.0.0

### Novidades e Recursos Principais (v3.0.0)

- **Integração Nativa com Pi-hole (DNS & Bloqueio de Anúncios):**
  - **Telemetria de Rede em Tempo Real:** Monitoramento completo de consultas DNS, total de domínios bloqueados pelo Gravity, taxa percentual de bloqueio e clientes ativos na rede.
  - **Controle de Bloqueio Instantâneo:** Ativação e desativação direta do bloqueio pelo Orbit, com opções de pausa programada (10 segundos, 30 segundos, 5 minutos ou indeterminado).
  - **Gestão de Domínios:** Adicione e remova domínios da Lista Branca (Allowlist) e Lista Negra (Blocklist) com validação visual e persistência imediata.
  - **Rankings de Domínios:** Gráficos e tabelas dos domínios mais requisitados e domínios mais bloqueados em toda a sua infraestrutura.

- **Central de Configurações & Perfil Unificada ("Minha Conta"):**
  - **Gestão Reativa de Integrações:** Ativação/desativação sob demanda para Home Assistant e Pi-hole, ocultando ou exibindo os itens na barra lateral instantaneamente com indicadores de status de conexão em tempo real.
  - **Configurações do Servidor & Porta Web:** Customização da porta de rede do contêiner do Orbit com validação de socket em tempo real no host, nome personalizado do servidor homelab, definição de página inicial padrão após login, ajuste na taxa de atualização da telemetria e confirmação para ações críticas.
  - **Personalização Visual e Novos Temas:** Upload de avatar de perfil customizado, planos de fundo personalizados (wallpaper) com controles de opacidade e desfoque, além de novos temas elegantes para homelab (Gruvbox Dark/Light, Catppuccin Mocha/Latte, Tokyo Night, Dracula, Nord e Cyberpunk).

- **App Store & Docker Stacks Avançados:**
  - **Customização Pré-Deploy na App Store:** Inspecione e personalize portas conflitantes, diretórios montados e variáveis de ambiente (PUID, PGID, senhas) antes de instalar qualquer aplicativo.
  - **Editor de Docker Compose YAML:** Crie e edite stacks completas através de um editor integrado com Monaco/CodeMirror, validação de sintaxe, biblioteca de templates e deploy 1-clique.
  - **Mecanismo de Backup & Restauração 1-Clique:** Crie backups compactados (.tar.gz) dos volumes e dados das aplicações com suporte a agendamento automático, histórico e restauração 1-clique.

- **Gerenciador de Arquivos & Multimídia:**
  - **Compartilhamento Samba (SMB):** Gerenciamento e compartilhamento de diretórios do host na rede local configurável diretamente pela interface.
  - **Upload Resiliente em Chunks:** Envio de arquivos grandes com particionamento inteligente, permitindo pausar e continuar transferências mesmo após recarregar o navegador.
  - **Player de Vídeo Otimizado:** Streaming de mídia de alta performance com suporte a legendas externas (.srt e .vtt) e compatibilidade com hardware modesto.
  - **Widget Meteorológico:** Card de previsão do tempo na Home com informações geolocalizadas em tempo real.

---

### Versões Anteriores

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
