---
name: container-security
description: "Boas práticas de segurança em imagens Docker e contêineres."
---

# Container Security

Quando lidar com Dockerfiles e orchestradores, certifique-se de:
- Executar como usuário não-root.
- Imagem base mínima (distroless/alpine).
- Tags/versões pinnadas (não usar `latest`).
- Secrets NUNCA dentro da imagem.
- Sem flags `privileged` desnecessárias ou `host networking` desprotegido.
- Suporte a verificação de vulnerabilidades da imagem e SBOM.
