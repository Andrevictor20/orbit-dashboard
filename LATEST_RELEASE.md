# Saturn Dashboard v3.7.6

### Novidades, Correções e Melhorias na Versão 3.7.6

### 🚀 Página Dedicada de Atualização do Contêiner (`/updating`)
- **Experiência Visual Contínua:** Introduzida página em tela cheia dedicada ao processo de atualização e reinício do contêiner Docker, eliminando telas congeladas ou incerteza durante o reinício do serviço.
- **Terminal de Logs em Tempo Real:** Console recolhível com streaming ao vivo de todas as etapas do Docker Engine (download de layers, recriação e inicialização).
- **Validação Rigorosa de Saúde e Handoff Seguro:** Monitoramento ativo da porta do contêiner com confirmação estrita de saúde (`/api/health`) antes do redirecionamento automático para a tela de login.

### 🧭 Ergonomia da Barra Lateral & Identidade Saturn
- **Fluxo Lógico Reorganizado:** Reordenação dos módulos por prioridade de uso diário (Visão Geral -> Loja -> Containers -> Arquivos -> Terminal -> Observabilidade -> Recursos Docker).
- **Redução de Ruído Cognitivo:** Remoção dos cabeçalhos rígidos "DASHBOARDS" e "DOCKER".
- **Identidade Enxuta:** Simplificação do cabeçalho de "Saturn Dashboard" para apenas **Saturn** com subtítulo **Admin** e migração retroativa de configurações salvas no navegador.
