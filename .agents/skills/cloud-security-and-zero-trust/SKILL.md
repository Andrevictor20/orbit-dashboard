---
name: cloud-security-and-zero-trust
description: "Segurança em nuvem, arquitetura Zero Trust e pipelines de CD sem segredos estáticos via OIDC. Cobre autenticação federada (GitHub Actions OIDC), assinatura de imagens com Cosign/Sigstore, geração de SBOM e defesa em profundidade (WAF, Rate Limiting, mTLS, proteção contra SSRF)."
---

# Cloud Security, Zero Trust & OIDC CD Pipelines

> **Propósito:** Blindar a infraestrutura e os pipelines de entrega contínua eliminando credenciais estáticas de longa duração, garantindo a integridade criptográfica de containers e aplicando o modelo de **Zero Trust** em todos os perímetros de nuvem.

---

## 1. Eliminação de Segredos Estáticos em CI/CD (OIDC Federated Auth)

> **⚠️ REGRA DE OURO:** NUNCA armazene credenciais de nuvem estáticas de longa duração (como `AWS_SECRET_ACCESS_KEY` ou chaves de serviço do GCP) nos secrets do GitHub Actions ou do GitLab CI.

### Como Funciona a Autenticação OIDC:
1. O GitHub Actions emite um token JWT de curta duração assinado pelo GitHub.
2. O provedor de nuvem (AWS/GCP/Azure) valida o token via **OpenID Connect (OIDC)** e assume uma Role temporária com escopo estrito apenas para a branch e repositório autorizados.
3. As credenciais temporárias expiram automaticamente após a execução do job.

```yaml
# Exemplo no GitHub Actions:
permissions:
  id-token: write # Obrigatório para solicitar o token OIDC
  contents: read

steps:
  - name: Configure AWS Credentials via OIDC
    uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy-role
      aws-region: us-east-1
```

---

## 2. Cadeia de Suprimentos & Assinatura de Imagens (Cosign & SBOM)

Para garantir que o código que está rodando em produção é exatamente o que foi compilado e testado no CI:

1. **Assinatura de Imagens com Cosign (Sigstore):**
   - Assine a imagem do container no pipeline de CI com chave efêmera via OIDC (Keyless signing):
     ```bash
     cosign sign --yes $IMAGE_URI
     ```
2. **Geração de SBOM (Software Bill of Materials):**
   - Gere o inventário completo de dependências da imagem utilizando ferramentas como **Syft**:
     ```bash
     syft $IMAGE_URI -o spdx-json > sbom.json
     cosign attach sbom --sbom sbom.json $IMAGE_URI
     ```
3. **Validação de Admissão no Cluster (Kyverno / OPA Gatekeeper):**
   - O cluster Kubernetes rejeita qualquer pod cuja imagem não contenha uma assinatura Cosign válida emitida pelo pipeline de CI da organização.

---

## 3. Defesa em Profundidade (Zero Trust Architecture)

Em uma arquitetura Zero Trust, a rede interna nunca é considerada confiável:

1. **Mutual TLS (mTLS):** Toda comunicação serviço a serviço deve ser criptografada e autenticada mutuamente via Service Mesh (Istio, Linkerd) ou certificados mTLS.
2. **Web Application Firewall (WAF) & Rate Limiting:**
   - Proteção contra OWASP Top 10 (SQLi, XSS), bots abusivos e ataques DDoS.
   - Aplicação de Rate Limiting por IP e por Token JWT em endpoints sensíveis (Login, Checkout, APIs públicas).
3. **Proteção contra SSRF (Server-Side Request Forgery):**
   - Bloquear acesso de containers a endpoints de metadados da nuvem (`169.254.169.254`) via NetworkPolicies ou iptables.
   - Validar rigorosamente qualquer URL fornecida pelo usuário antes de realizar requisições HTTP internas.
4. **Isolamento de Egress (Saída de Rede):**
   - Containers só devem se comunicar com a internet pública se houver uma necessidade explícita declarada. Bloqueie conexões de saída arbitrárias por padrão.
