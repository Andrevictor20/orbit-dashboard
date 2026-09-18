# Saturn Dashboard v3.7.1

### Novidades, Correções e Melhorias na Versão 3.7.1

### 🛠️ Correções
- **Script de Instalação Automatizada (`install.sh`):**
  - **Eliminação de Falha de Segmentação:** Corrigida a recursão infinita na verificação de status e restaurado o alias legado `is_orbit_installed`, garantindo execução 100% estável via pipe (`curl -fsSL ... | bash`) no Bash, Fish e Zsh.
  - **Fallback Robusto de Diretório:** Garantida a inicialização segura de `INSTALL_DIR` sob `set -euo pipefail` com resolução em cadeia para `/DATA/saturn`, `$HOME/saturn` e `/opt/saturn`.
  - **Limpeza de Configurações:** Ajustada a limpeza de arquivos residuais de journald (`00-orbit.conf`).

### 📚 Documentação & Experiência
- **README Comercial de Alta Conversão:** Cabeçalho atualizado com o logotipo oficial do Saturn, comando de instalação único em destaque no topo (*Above the Fold*), tabela comparativa de benefícios e seções técnicas segregadas.
- **Guia Oficial da App Store (`docs/APP_STORE.md`):** Documentação completa do catálogo de mais de 920 aplicações, badges de compatibilidade de arquitetura (`x86_64` vs `ARM64`), alertas de CPU e guia passo a passo para submissão de apps comunitários.
- **Licenciamento Oficial:** Inclusão do arquivo `LICENSE` (MIT) na raiz do repositório.
