# Saturn Dashboard v3.7.7

### Novidades, Correções e Melhorias na Versão 3.7.7

### 👥 Sistema Multiusuário com RBAC & Controle de Acesso
- **Papéis Granulares (Admin e Membro):** Introduzido suporte nativo a múltiplos usuários com separação estrita de privilégios.
- **Painel de Gestão de Usuários:** Nova aba dedicada no painel de configurações para criar, editar, ativar/desativar, redefinir senhas e excluir contas.
- **Blindagem do Sistema de Arquivos:** Usuários comuns têm acesso a unidades de armazenamento e discos externos (`/media`, `/mnt`, `/DATA`) para upload e download, mas são estritamente impedidos de excluir, mover arquivos ou acessar diretórios críticos do host (`/`, `/host/etc`).
- **Visibilidade Seletiva de Contêineres:** Administradores podem alternar a visibilidade de contêineres específicos para membros comuns, prevenindo acesso não autorizado a serviços sensíveis.
- **Terminal Web e Atualizações Protegidos:** Recursos operacionais de alto impacto (Terminal Web, Backups, Atualizações do Sistema e Gerenciamento de Portas) reservados exclusivamente para Administradores.
- **Migração Transparente:** O primeiro boot migra automaticamente a conta legada para Administrador com senhas Argon2id e TOTP intactos.

### 🎬 Correção Definitiva de Reprodução de Vídeo (Fim do Carregamento Infinito)
- **Correção de Transcodificação FFmpeg:** Removido parâmetro conflitante `-flags low_delay` que provocava descarte total de frames de vídeo em streams H.264 Hi10P e HEVC, restabelecendo reprodução fluida a >10x de velocidade de codificação.
- **Streaming HTTP de Range Contínuo:** Eliminado o corte arbitrário de 4MB em requisições de range aberto (`bytes=0-`), mantendo o fluxo contínuo de dados até o final do arquivo sem congelamento do buffer.
- **Duração e Barra de Progresso:** Extração unificada da duração real do vídeo diretamente pelo backend, permitindo busca e progresso precisos mesmo em fluxos transcodificados.
- **Tratamento Resiliente de Autoplay:** Captura de restrições de reprodução automática de navegadores modernos, desativando o estado de buffering e exibindo o botão de play de imediato.

### ⚡ Miniaturas de Vídeo Ultra-Rápidas (<300ms)
- **Fast Keyframe Seek:** Eliminação da sondagem de duração via `ffprobe` e do seek profundo no arquivo; a extração ocorre diretamente nos primeiros segundos do arquivo em menos de 300ms.
- **Proteção Contra I/O Thrashing:** Expansão do semáforo de concorrência para 4 workers com cache em disco em camada dupla, garantindo carregamento ágil mesmo em pastas com dezenas de vídeos pesados em HDs externos USB.
