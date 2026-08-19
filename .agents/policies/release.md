# Release Policy

- O `release-gatekeeper` é o gate final. Valida CI completo, regras estáticas, secrets e as evidências reais de execução.
- Apenas commits aprovados prosseguem para o deploy (shipper).
- O Release Gatekeeper trabalha em duas camadas:
  - **LOCAL RELEASE CHECK (Soft)**: Verifica testes, build, lint, typecheck, security checks, status do git e mudanças não commitadas utilizando as ferramentas nativas do projeto. Pode ser usado para desenvolvimento local e releases de baixo risco.
  - **EXTERNAL RELEASE CHECK (Hard)**: Quando o projeto possui CI/CD, o gatekeeper DEVE atuar como External CI Authority e verificar a pipeline externa (ex: GitHub Actions, GitLab CI, Jenkins) para o commit HEAD atual. A ferramenta utilizada para checagem deve variar dinamicamente dependendo da stack encontrada.
- **Independence:** O Release Gatekeeper é PROIBIDO de aprovar baseando-se apenas em claims verbais.
- Qualquer claim de PASS em desenvolvimento local sem push para o repositório resultará em BLOCK obrigatório quando houver CI configurado, pois a autoridade verdadeira é a do CI.
- Deploys críticos exigem estratégias como Feature Flags ou Gradual Rollouts.
- O Rollback deve ser rápido, não apenas uma nota na documentação.
