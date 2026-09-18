# Saturn Dashboard v3.7.0

### Novidades, Correções e Melhorias na Versão 3.7.0

- **Unificação Completa do Ecossistema Saturn & Identidade Própria:**
  - **Identidade e Nomenclatura Oficiais:** O sistema e os repositórios foram 100% consolidados sob a marca **Saturn** (`Andrevictor20/saturn` no GitHub / GHCR e `victorandre280/saturn` no Docker Hub).
  - **Purga de Resíduos e Ferramentas Mortas:** Remoção completa de scripts legados de portabilidade (`tools/migrator/`, liberando mais de 393 MB em disco) e eliminação definitiva de menções legadas em código-fonte, configurações, logs e testes.
  - **Design System & Tokens:** Padronização integral dos tokens CSS (`--saturn-*`) e logotipo vetorial dinâmico `SaturnLogo`.

- **App Store Oficial Desacoplada (`saturn-apps`):**
  - **Catálogo Autônomo:** 916 aplicações oficiais organizadas, padronizadas e compiladas nativamente via `saturn-apps/compiler/build_catalog.py`, sem dependências de upstream de terceiros.
  - **Compatibilidade de Arquitetura Multi-Plataforma:** Chips e badges inteligentes (`x86_64` / `ARM64`) indicam se cada aplicação roda na arquitetura do servidor, alertando com antecedência caso o processador do host não suporte o aplicativo.
  - **Filtro de Arquitetura na Loja:** Novo filtro modular que permite listar apenas os aplicativos 100% compatíveis com a CPU do servidor.
  - **Gerenciador de Repositórios da Loja:** Modal para gerenciar e alternar fontes comunitárias da loja com persistência em `stores.json`.

- **Correção e Robustez na Restauração de Backups:**
  - **Localizador Inteligente de Conteúdo:** Restauração a partir de arquivos `.tar.gz` agora detecta automaticamente o diretório raiz dos dados e descobre o aplicativo mesmo a partir de uploads com nomes genéricos.
  - **Docker Force-Recreate:** Contêineres existentes são recriados sem conflitos de socket ou portas ao restaurar snapshots completos.

- **Terminal Web Integrado & Streaming de Mídia:**
  - **Terminal Interno Direto:** Acesso ao console do servidor com 1 clique usando shell nativo (`/bin/bash` ou `/bin/sh`) via PTY, além de suporte a proxy SSH.
  - **Streaming Otimizado (RFC 7233):** Suporte nativo a sufixo de range para localização instantânea de metadados em vídeos e reprodução sem travamentos, com suporte a legendas WebVTT com CORS.
  - **Miniaturas de Arquivos com Cache em Disco:** Miniaturas de imagens, vídeos e PDFs em `/api/files/thumbnail` com cache SHA-256 e baixo consumo de CPU.
