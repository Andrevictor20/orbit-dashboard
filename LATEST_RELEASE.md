# Orbit Dashboard v3.2.3

### Novidades e Correções (v3.2.3)

- **Correção Definitiva de Download e Instalação de Imagens Docker:**
  - **Eliminação de Deadlock no Pipe do Kernel Linux:** Remoção de pipe buffers bloqueantes em comandos de pull/up com redirecionamento para `Stdio::null()`, impedindo travamento de processos com mais de 64KB de saída.
  - **Progresso de Extração Suave:** Reconhecimento das mensagens de descompressão (`Extracting`) permitindo que a barra de progresso avance continuamente até 58% em vez de estagnar em 55%.
  - **Deduplicação de Logs de Alta Frequência:** Linhas contínuas de progresso e download atualizam o último registro no buffer de logs in-place, prevenindo estouramento do histórico.
  - **Resolução de Loop Infinito de Polling no Frontend:** Estabilização da chave de dependência reativa do React (`activeAppTaskIdsKey`) e encerramento terminativo imediato ao detectar HTTP 404.
  - **Isolamento Concorrente de Cache do Sistema:** Sincronização de testes em `system_update_tests.rs` via mutex resiliente prevenindo condições de corrida na validação de releases no CI.

### Novidades e Recursos Principais (v3.2.0)

- **Autenticação em Duas Etapas (2FA/TOTP) Opcional & Multi-Sistema:**
  - **Compatibilidade Universal (RFC 6238):** Funciona perfeitamente com qualquer app autenticador (Google Authenticator, Microsoft Authenticator, Apple Passwords, Bitwarden, 1Password, Authy, Aegis, 2FAS, YubiKey Authenticator).
  - **100% Opcional (Opt-in):** Você escolhe quando e se deseja ativar. Para quem não habilitar, o login continua direto com usuário e senha.
  - **Gerenciamento no Painel Geral de Configurações:** Ativação e desativação disponíveis diretamente na aba de Conta do menu de configurações/perfil.
  - **Setup Intuitivo com QR Code e Chave Manual:** Modal com QR Code em alta resolução, chave secreta Base32 com botão de cópia rápida e validação por código de 6 dígitos antes de habilitar.
  - **8 Códigos de Recuperação de Uso Único:** Geração de códigos de backup com cópia rápida e download em arquivo de texto (`.txt`), hasheados com Argon2 e consumidos permanentemente do disco após o uso.
  - **Blindagem Anti-Bypass e Desativação Segura:** Token temporário intermediário isolado no login que não concede acesso à API até a confirmação do código, e exigência obrigatória da senha atual para qualquer desativação.

- **Criação e Gestão de Rotas Ingress no Cloudflare Tunnels:**
  - **Criação Direta de Rotas no Dashboard:** Adicione novas regras de ingresso públicas sem precisar acessar o painel web da Cloudflare.
  - **Seleção Facilitada de Containers Locais:** Preenchimento automático de serviços internos baseado nos contêineres Docker locais e suas portas expostas.
  - **Exclusão Segura com Diálogo de Confirmação:** Remova rotas de túnel diretamente pela tabela de gerenciamento com atualização instantânea na Cloudflare.
  - **Dicas Inteligentes de DNS:** Instruções contextuais sobre apontamentos CNAME e Wildcard DNS para funcionamento imediato de rotas.

- **Telemetria Completa de DNS Pi-hole:**
  - **Resolução de Top Domínios:** Carregamento correto de domínios permitidos e bloqueados em instâncias Pi-hole v6 (REST FTL) e v5 (PHP).
  - **Top Clientes & Dispositivos:** Identificação visual com ícones dedicados por tipo de hardware (Smartphone, Laptop, Servidor), IP/hostname e volume relativo de requisições.
  - **Análise de Tipos de Registro DNS & Servidores Upstream:** Visualização gráfica da distribuição de consultas (A, AAAA, HTTPS, PTR) e provedores de upstream externos.
  - **Feed de Consultas Recentes em Tempo Real:** Registro das últimas consultas com badges de status (Permitido, Bloqueado, Cache) e atalho de 1-clique para adicionar domínios à Whitelist ou Blacklist.

- **Unificação do Editor Docker Compose na App Store:**
  - **Instalação Personalizada e Docker Run:** Aba dedicada na App Store reunindo o editor YAML de Compose e comando rápido Docker Run em um modal otimizado.
  - **Navegação Simplificada:** Redirecionamento da rota `/compose` para a App Store com abertura automática do modal de customização, mantendo a barra lateral mais enxuta.

- **Mini Gerenciador de Arquivos para Volumes de Containers:**
  - **Seletor Visual de Pastas do Host:** Botão com ícone de pasta ao lado dos campos de volume para navegar visualmente pelo sistema de arquivos do servidor.
  - **Criação Rápida de Diretórios:** Crie novas pastas no host diretamente pelo modal do seletor.

- **Correção Definitiva de Wallpaper e Stacking Context:**
  - **Visibilidade Plena:** Conteúdos das páginas e cabeçalhos não são mais ocultados ou sobrepostos pelo wallpaper personalizado.
