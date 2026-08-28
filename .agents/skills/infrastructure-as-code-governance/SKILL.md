---
name: infrastructure-as-code-governance
description: "Governança, modularização e segurança em Infraestrutura como Código (IaC). Cobre Terraform/OpenTofu, Kubernetes (Helm, Kustomize), Docker Compose, NetworkPolicies, least privilege em IAM e validação estática pré-apply."
---

# Infrastructure as Code (IaC) Governance & Security

> **Propósito:** Garantir que toda infraestrutura provisionada por código (Terraform, OpenTofu, Kubernetes, Docker Compose) seja determinística, modular, segura por padrão e validada estaticamente antes de qualquer `apply`.

---

## 1. Princípios Fundamentais de IaC

1. **Infraestrutura Imutável e Declarativa:** Recursos nunca devem ser modificados manualmente no painel da nuvem (*ClickOps*). Todo estado reside no código versionado em Git.
2. **Princípio do Menor Privilégio (*Least Privilege* em IAM):**
   - Nunca use permissões de `AdministratorAccess` ou `*` em roles de serviços.
   - Cada serviço ou workload deve possuir apenas as permissões exatas necessárias para suas operações (ex: `s3:GetObject` em um bucket específico).
3. **Isolamento de Redes & Defesa em Perímetro:**
   - Recursos de dados (bancos de dados, Redis, filas) devem residir estritamente em **subnets privadas sem IP público**.
   - Toda comunicação entre pods no Kubernetes deve ser governada por **`NetworkPolicies`** com política padrão de negação (*Default Deny*).

---

## 2. Boas Práticas por Tecnologia

### 2.A Terraform / OpenTofu
- **Remote State com State Locking:** Armazene o arquivo de estado em backend remoto seguro (ex: S3 com criptografia SSE-KMS e tabela DynamoDB para lock, ou Terraform Cloud).
- **Sem Segredos em Plaintext:** Nunca declare credenciais ou senhas em arquivos `.tf` ou variáveis padrão. Utilize integração com HashiCorp Vault, AWS Secrets Manager ou variáveis de ambiente seguras.
- **Módulos Versionados e Imutáveis:** Módulos reutilizáveis devem ser versionados via tags do Git (`source = "...?ref=v1.2.0"`).

### 2.B Kubernetes (Manifests, Helm & Kustomize)
- **Security Context Restrito por Padrão:**
  ```yaml
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop:
        - ALL
  ```
- **Limites de Recursos Obrigatórios:** Todo container deve definir `resources.requests` e `resources.limits` para CPU e Memória para evitar esgotamento de nós (OOMKilled).
- **NetworkPolicy Default Deny:**
  ```yaml
  apiVersion: networking.k8s.io/v1
  kind: NetworkPolicy
  metadata:
    name: default-deny-all
  spec:
    podSelector: {}
    policyTypes:
      - Ingress
      - Egress
  ```

---

## 3. Validação Estática Pré-Apply (IaC Lint & Security Scan)

Antes de aprovar qualquer PR que altere arquivos de infraestrutura:
1. **Sintaxe & Formatação:** Executar `terraform fmt -check` e `terraform validate` (ou `helm lint`).
2. **Scanner de Segurança Estática:** Executar ferramentas como **Checkov**, **tfsec** ou **Trivy Config** para detectar portas públicas abertas (`0.0.0.0/0`), falta de criptografia em repouso e roles excessivamente permissivas.
3. **Plano de Execução Auditável:** Toda alteração deve gerar um `terraform plan` documentado com as contagens exatas de recursos a criar (`to add`), alterar (`to change`) ou destruir (`to destroy`).
