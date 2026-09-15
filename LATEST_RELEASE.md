# Orbit Dashboard v3.6.4

### Novidades, Correções e Melhorias na Versão 3.6.4 (Patch)

- **Sistema Completo de Backup & Restauração (Full-State Restore):**
  - **Customizações Visuais Inclusas:** Sincronização bidirecional e backup completo de temas ativos, paletas de cores (incluindo o novo tema OLED), wallpapers e avatares customizados através do novo endpoint `/api/system/customization` e arquivo `data/customization.json`.
  - **Preservação Total de Integrações:** Inclusão de todas as configurações de integrações (`homeassistant.json`, `cloudflare.json`, `pihole.json`, `config/samba.json`) e links customizados no arquivo físico de backup.
  - **Invalidação e Recarregamento Imediato de Caches:** Recarregamento em tempo de execução de todos os caches em memória do Axum durante a restauração (`LINKS_CACHE`, `HA_CONFIG_CACHE`, `CLOUDFLARE_CONFIG_CACHE`, `PIHOLE_CONFIG_CACHE`, `SETTINGS_CACHE`, `CUSTOMIZATION_CACHE`), eliminando a necessidade de reiniciar o Orbit para que as alterações surtam efeito.
  - **Subida Automática de Contêineres Restaurados:** Ao restaurar snapshots do tipo `system_full` ou `all_containers`, o sistema agora percorre automaticamente os diretórios em `data/apps/*` e executa `docker compose up -d` para todos os apps restaurados, reativando todos os serviços sem intervenção manual.
  - **Nova Interface para Aplicar Backups:** Modal dedicado (`ApplyBackupModal`) com abas para escolha de snapshots existentes no servidor ou upload direto de arquivos `.tar.gz` do computador com 1 clique, além de botões de acesso rápido no cabeçalho e na tabela de backups.

- **Correção de Contraste dos Botões no Tema Preto OLED:**
  - Resolução definitiva da falta de contraste em botões primários (`+ Instalar Aplicativo`, `Novo Contêiner`, etc.): sobre o tom de destaque prateado/claro (`#e4e4e7`) do tema OLED, os botões sólidos agora impõem texto e ícones em preto piano `#000000`, garantindo contraste estrito superior a 16:1 e legibilidade perfeita.

- **Eliminação do "Corte" no Topo dos Cards de Contêineres:**
  - Ajuste de espaçamento vertical e compensação de margens na grade de contêineres (`pt-3 px-1.5 pb-6 -mt-1.5 -mx-1.5`), fornecendo 12px de folga livre no topo da área de rolagem.
  - Adicionada a camada de sobreposição `hover:z-10` aos cards individuais e stacks, impedindo que a transição de elevação (`-translate-y`) e as bordas superiores sejam cortadas pelo overflow.

- **Novo Tema Dinâmico "Cores do Wallpaper" (Estilo Linux Shells / Pywal / Material You):**
  - Algoritmo de quantização e análise cromática via Canvas que processa a imagem do wallpaper em segundo plano, agrupando os pixels por intervalos de matiz (HSL) e selecionando a cor mais vibrante e harmônica para a interface.
  - Geração dinâmica das variáveis CSS (`--orbit-500`, `--orbit-600`, `--accent`, `--glass-shadow`) e cálculo de contraste de luminância para texto preto ou branco.
  - Nova opção no menu de temas e card de prévia visual na aba de personalização com ativação em 1 clique ("Aplicar Cores" / "Ativo").
