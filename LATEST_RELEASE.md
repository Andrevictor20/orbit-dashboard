# Saturn Dashboard v3.8.0

### Novidades, Correções e Melhorias na Versão 3.8.0

### 🚀 Atualizações Imperceptíveis em Segundo Plano (Zero-Downtime Seamless Updates)
- **Fim do Bloqueio de Tela e Travamento em 10%:** Eliminado o redirecionamento forçado para a página `/updating`. O processo de atualização do contêiner agora é executado 100% em segundo plano, permitindo que o usuário continue navegando livremente pelo painel (acessar Arquivos, Contêineres, Loja de Aplicativos, Métricas, etc.) sem interrupções.
- **Gerenciamento Global de Atualização (`SystemUpdateContext`):** Novo contexto React centralizado com polling assíncrono não-obstrutivo, persistência suave de estado e monitoramento contínuo em tempo real.
- **Pílula Flutuante & Indicador Dinâmico no Cabeçalho:** Adicionado o componente `SystemUpdateFloatingBar` no canto inferior da tela e um ícone animado com tooltip de porcentagem no cabeçalho do painel, permitindo acompanhar o progresso ou reabrir o terminal de logs com 1 clique a qualquer momento.
- **Timeouts Resilientes no Backend Rust:** Adicionada proteção de timeout assíncrono de 45 segundos no stream de download de camadas Docker via biblioteca `bollard` (`tokio::time::timeout`), prevenindo travamento indefinido caso o registry ou a rede sofram oscilações.
- **Pre-Pull Seguro & Troca Atômica:** O contêiner em execução permanece ativo respondendo a todas as requisições até o exato instante em que a imagem está 100% descompactada no disco. A recriação do contêiner leva menos de 2 segundos.
- **Reconexão Suave e Toast de Conclusão:** O sistema realiza detecção de saúde em background via `/api/health` e exibe uma notificação amigável convidando o usuário a recarregar o painel para usufruir dos novos recursos, sem perda de sessão.
- **Página `/updating` com Botão de Retorno:** Adicionado botão de retorno ao dashboard e recuperação automática caso a rota dedicada seja acessada diretamente.
