# Saturn Dashboard v3.9.0

### Novidades, Correções e Melhorias na Versão 3.9.0

### 🛡️ Isolamento Estrito de Integrações & Guia de Permissões para Membros (RBAC)
- **Bloqueio Total de Integrações para Membros:** As integrações **Home Assistant**, **Cloudflare Tunnels** e **Pi-hole** agora são estritamente exclusivas para administradores. Membros comuns não podem configurar, editar, visualizar tokens, gerenciar túneis ou acionar serviços integrados.
- **Blindagem de Rotas de API no Backend (Rust):** Todas as rotas sob `/api/homeassistant/*`, `/api/cloudflare/*`, `/api/pihole/*` e `/api/docker/links/{id}` foram migradas para o middleware `require_admin`, retornando `403 Forbidden` imediato para qualquer tentativa de acesso por membros.
- **Proteção Visual e de Navegação no Frontend:** As seções e abas de integrações foram completamente ocultadas do menu lateral (`SidebarNav`) e do modal de configurações (`ProfileModal`). Rotas diretas (`/homeassistant`, `/cloudflare`, `/pihole`, `/terminal`, etc.) agora contam com o guardião `<AdminRoute>`, redirecionando acessos não autorizados para o painel principal.
- **Modal de Detalhes de Permissões (`MemberPermissionsModal`):** Adicionado modal informativo com visualização clara e em duas colunas detalhando exatamente o que um membro comum **PODE acessar** (Arquivos externos, streaming, apps autorizados, perfil/2FA) e o que ele **NÃO PODE acessar** (Integrações, Terminal, ações destrutivas, atualizações/backups, Docker avançado).
- **Acesso ao Guia de Permissões em 1 Clique:** O novo modal pode ser aberto pelo botão "Mais Detalhes" no cabeçalho da Gestão de Usuários ou pelo link interativo no card de papel "Membro" durante a criação/edição de usuários.


