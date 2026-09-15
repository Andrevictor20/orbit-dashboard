# Orbit Dashboard v3.6.3

### Novidades, Correções e Melhorias na Versão 3.6.3 (Patch)

- **Streaming de Vídeo de Alto Desempenho (Direct Play sem Engasgos):**
  - Removido o teto artificial de chunk de 4MB em requisições de range contínuo (`bytes=X-`), permitindo que a transmissão flua continuamente governada pela janela de TCP do host e pelo buffer nativo do reprodutor do navegador.
  - Buffer assíncrono de I/O de 64KB (`IO_BUFFER_CAPACITY`) via `ReaderStream` reduzindo em até 16x o número de syscalls no kernel Linux e preservando a CPU em dispositivos compactos (Raspberry Pi e Celeron).
- **Pipeline Expandido de Legendas & Prevenção de I/O Thrashing:**
  - Suporte expandido a múltiplos formatos de legenda: `.srt`, `.vtt`, `.ass`, `.ssa`, `.sub`, `.sbv` (YouTube) e `.smi`.
  - Conversão dinâmica e em cache para WebVTT com compatibilidade total com o reprodutor nativo HTML5.
  - Filtro estrito no `ffprobe` aceitando exclusivamente codecs textuais e descartando faixas bitmap pesadas (como PGS e VobSub) que causavam travamentos no FFmpeg.
  - Bloqueio de extração singleflight (`EXTRACTION_MUTEX`) e limitação a `-threads 1` no FFmpeg, eliminando a concorrência excessiva de disco e CPU.
- **Frontend — Injeção Lazy de Legendas & Atalho de Streaming Externo (VLC):**
  - Injeção sob demanda (`lazy track`): apenas a faixa de legenda ativa é renderizada no DOM, prevenindo que o navegador dispare requisições simultâneas para todas as faixas embutidas no carregamento inicial do vídeo.
  - Botão dedicado no cabeçalho do player de vídeo para cópia imediata da URL de streaming direto (`Stream / VLC`), facilitando a reprodução direta em tocadores externos (VLC, MPV, IINA) quando o arquivo utiliza formatos de áudio não suportados pelo navegador (ex: AC3/DTS).
  - Tipografia de legendas otimizada via CSS `::cue` com fundo semitransparente escuro e contraste nítido em qualquer cena.
- **Backend & Compilador — Resolução de Diagnósticos:**
  - Ajustes de tipo e inferência de fatias em `files_tests.rs` e `streaming.rs` eliminando warnings do rust-analyzer e mantendo conformidade com a regra No God Files (< 500 linhas).

### Novidades, Correções e Melhorias na Versão 3.6.2 (Patch)

- **Cloudflare Tunnels — Associação Port-First & Guarda contra Conflitos de Porta:**
  - Prioridade primária por portas (`public_ports` e portas internas) na vinculação de rotas Ingress a contêineres Docker, resolvendo casos onde subdomínios divergiam ou eram curtos (ex: `ha.rasppi.cloud:8123`, `books.rasppi.cloud:5000`, `pdi.rasppi.cloud:83`).
  - Guarda estrita contra conflitos de porta: contêineres que não escutam na porta configurada na rota são proibidos de serem vinculados por heurísticas de subdomínio (ex: `home.rasppi.cloud:5172` não associa mais falsamente o contêiner `homeassistant:8123`).
  - Sincronização bidirecional completa com `custom_links.json` (ajustes manuais têm prioridade máxima absoluta).
  - Modal interativo na tabela do Cloudflare (`LinkRouteContainerModal`) permitindo vincular, alterar ou desvincular qualquer contêiner Docker diretamente na tela do Cloudflare sem necessidade de navegar até a página de contêineres.
- **Dashboard — Visualização In-Card Top 5 (CPU e RAM) & Mapeamento de Aplicativos:**
  - Alternância de visualização interna ("In-Card View") diretamente dentro dos cards de CPU e RAM com botão de alternância e retorno suave, eliminando popovers flutuantes que sobrepunham outros elementos e a dock.
  - Resolução inteligente de processos (`processAppResolver`): processos com nomes de binários genéricos (ex: `python3`, `java`, `node`, `cron.php`) agora exibem o nome do aplicativo correspondente e seu ícone oficial (ex: **Home Assistant**, **Kavita**, **Stirling PDF**, **Moodle**) cruzando dados com contêineres Docker ativos e catálogo canônico.
- **Tema Preto OLED / Preto Piano (Full Black):**
  - Novo esquema de cores OLED com fundo preto absoluto `#000000` (pixels 100% desligados em telas OLED/AMOLED), cartões translúcidos piano profundo (`rgba(10, 10, 10, 0.78)`) e bordas em corte de diamante, substituindo o tema One Dark com compatibilidade retroativa e paleta monocromática do OrbitLogo dedicada.
- **Backend & Compilador — Resolução de Diagnósticos do Rust-Analyzer:**
  - Ajustes idiomáticos em `matching.rs` e `cloudflare_tests.rs` com coerção nativa de fatias, blocos de match explícitos e leitura segura de JSON.

### Correções e Melhorias na Versão 3.6.1 (Patch)

- **Segurança:** Atualização de dependências Rust — `rustls 0.23.45` (corrige RUSTSEC-2026-0285: TLS 1.3 handshake boundary) e `chacha20 0.10.2` (crate anterior yanked do crates.io).
- **UI — Relógio maior:** Tamanho do horário aumentado no Hero Header (`text-sm`, ícone `w-4`) com offset GMT mais legível.
- **UI — Armazenamento:** Corrigido texto truncado nos nomes de discos (`HD Externo`, `microSD`) — layout agora usa `flex-1` sem `max-w` fixo.
- **Backend — GPU Raspberry Pi:** Detecção nativa do VideoCore via `vcgencmd` (clock V3D, VRAM split, temperatura), exibindo modelo do Pi no card de GPU.

### Novidades e Recursos da Versão 3.6.0

- **Sistema Completo de Backups e Restauração Inteligente:**
  - **Backup de Sistema Completo:** Crie snapshots compactados de todo o ambiente Orbit com 1 clique, preservando configurações centrais (`orbit_auth.json`, `settings.json`, `custom_links.json`, `jwt.secret`), todas as integrações (`pihole.json`, `cloudflare.json`, `samba.json`, Home Assistant), rotinas de agendamento, todos os aplicativos em `/data/apps/*` com volumes e o manifesto Docker de contêineres.
  - **Backup de Configurações & Integrações:** Snapshot ultraleve contendo apenas credenciais, tokens, rotas e parâmetros do Orbit sem a carga de volumes de dados.
  - **Backup de Todos os Contêineres & Apps:** Snapshot em massa para proteger todos os aplicativos e contêineres gerenciados.
  - **Restauração Atômica e Segura:** Descompactação e verificação automática do manifesto `orbit_manifest.json` com modal de confirmação reforçada exigindo a digitação da palavra `RESTAURAR` para prevenir ações acidentais.
  - **Rotinas Automáticas com Escopo:** Configure agendamentos automáticos periódicos (diários/semanais) para todo o sistema, todas as aplicações ou apps selecionados.

- **Telemetria de GPU e Top 5 Processos em Tempo Real:**
  - **Card de GPU na Visão Geral:** Acompanhe percentual de uso, consumo de memória VRAM (usada/total), temperatura em tempo real, gráfico histórico sparkline e detecção do modelo da placa de vídeo.
  - **Top 5 Processos (CPU e RAM):** Acesse rapidamente através do botão no canto superior dos cards os processos com maior consumo, identificando PID, nome, tag do contêiner e link direto para detalhes.
  - **Hero Header de Boas-Vindas:** Barra superior com saudação de boas-vindas, relógio dinâmico, fuso horário, alternador de formato 12h/24h e widget climático com Qualidade do Ar (AQI + status).
  - **Armazenamento Redesenhado:** Visual mais limpo com foco no espaço livre restante de cada partição.

- **Expansão Global Multilíngue (9 Idiomas):**
  - Suporte completo e oficial para **Japonês (ja)**, **Chinês Simplificado (zh)**, **Coreano (ko)**, **Árabe (ar - com suporte a RTL)**, **Francês (fr)**, **Espanhol (es)** e **Italiano (it)**, além de **Português (pt)** e **Inglês (en)**.
  - Arquitetura de internacionalização modular por domínios (`common`, `backups`, `containers`, `docker`, etc.) garantindo 100% de paridade de tradução e carregamento ultrarrápido.

- **Estabilidade, Qualidade de Código e Performance:**
  - Decomposição modular completa de componentes extensos no frontend e backend, mantendo arquivos enxutos e altamente sustentáveis.
  - Suíte completa de testes automatizados unitários e de integração 100% aprovada.
