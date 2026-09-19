# Saturn Dashboard v3.8.1

### Novidades, Correções e Melhorias na Versão 3.8.1

### 🐛 Correção Crítica de Navegação e Fim do Loop de Atualização no Túnel
- **Fim do Deadlock em `/updating`:** Removida a verificação obstrutiva em `ProtectedRoute.tsx` que interceptava as requisições e forçava redirecionamento em loop para a rota `/updating` quando a flag residual `saturn_updating` existia no `localStorage` do navegador.
- **Auto-Recuperação de Estado Idle:** Na página `/updating`, se o backend informar que o sistema está em repouso (`status: 'idle'`), todas as chaves residuais de atualização (`saturn_updating` e `saturn_target_version`) são limpas automaticamente e o usuário é redirecionado instantaneamente para o painel principal (`/`).
- **Limpeza Segura no Botão de Retorno:** O botão "Voltar ao Dashboard" agora elimina proativamente qualquer flag residual de atualização no armazenamento local do navegador.

