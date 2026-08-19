---
name: security-sentinel-review
description: Revisão proativa de segurança da informação além do que a análise estática automática cobre — gestão de secrets, superfícies sensíveis (autenticação, dados pessoais, pagamentos, permissões), política de dependências, e prontidão para incidentes. Use esta skill sempre que uma proposta do navigator tocar em dado sensível, autenticação, autorização, pagamentos, upload de arquivo ou integração com serviço externo que recebe dados do usuário, e sempre que o usuário pedir uma revisão de segurança mais ampla do projeto (não apenas rodar o scanner). Não confundir com ci-security-gate, que é o scanner automático rodando a cada commit — esta skill é a revisão de julgamento humano/agente sobre risco, algo que ferramenta automática não decide sozinha.
---

# Security Sentinel Review

Análise estática (Brakeman, Semgrep, etc., coberta pela skill `ci-security-gate`) pega padrões conhecidos de código inseguro. Ela não decide se uma decisão de produto/arquitetura é arriscada, não audita gestão de secrets, e não tem visão de "o que fazemos se isso vazar". Esta skill cobre esse espaço.

## Quando revisar (gatilhos)

Acione esta skill sempre que uma proposta envolver:
- **Autenticação/autorização** — login, sessão, tokens, permissões, controle de acesso a recursos de outros usuários.
- **Dados pessoais (PII)** — nome, email, documento, endereço, dado de saúde, qualquer dado que identifique uma pessoa.
- **Pagamentos** — qualquer fluxo que toque em cartão, PIX, dados financeiros, mesmo via provedor terceirizado.
- **Upload de arquivo ou input de URL fornecido pelo usuário** — risco de path traversal, SSRF, arquivo malicioso.
- **Integração externa que recebe dado do usuário** — o que é enviado, para onde, e sob qual garantia de proteção do terceiro.

## Checklist de revisão por categoria

**Secrets e credenciais**
- Nenhum secret hardcoded ou commitado (coordenar com `deploy-pipeline-conductor` para gestão por ambiente).
- Rotação de credenciais é possível sem reescrever código.
- Escopo mínimo: cada credencial/API key tem só a permissão necessária, não acesso total por conveniência.

**Autenticação e autorização**
- Senhas (se houver) usam hashing adequado, nunca texto plano ou hash reversível.
- Sessões/tokens têm expiração e podem ser revogados.
- Toda ação sobre um recurso verifica se o usuário autenticado tem permissão sobre **aquele recurso específico** (não só "está logado") — esse é o erro mais comum (broken object-level authorization).

**Dados pessoais**
- Dado sensível é coletado só quando necessário para a funcionalidade (minimização).
- Existe forma de o usuário ver/excluir seus próprios dados, se a jurisdição aplicável exigir.
- Dado sensível em repouso é protegido de forma proporcional ao risco (encryption at rest quando fizer sentido).

**Superfícies de input não confiável**
- Toda URL/host fornecido por usuário e usado para requisição server-side é validado contra SSRF.
- Todo path/nome de arquivo fornecido é normalizado antes de tocar o filesystem.
- Rate limiting em endpoints públicos de alta sensibilidade (login, reset de senha, formulários públicos).

**Dependências e superfície de terceiros**
- Toda nova dependência externa é avaliada quanto à necessidade real (menos dependências = menos superfície de ataque) antes de ser adicionada.
- Integrações com terceiros que recebem dado do usuário são avaliadas quanto à política de retenção/proteção desse terceiro, quando relevante.

## Prontidão para incidentes

Para projetos com dado sensível de usuários reais em produção, confirme que existe (mesmo que simples):
- Forma de identificar rapidamente o que foi exposto/afetado em caso de incidente (logs de acesso a dado sensível).
- Um caminho claro para revogar credenciais/sessões comprometidas rapidamente.
- Registro de quem/quando decisões de segurança relevantes foram tomadas (coordenar com `living-docs-keeper`).

## Como reportar

Ao concluir uma revisão, categorize achados por severidade (crítico/alto/médio/baixo) e proponha a correção mínima para cada um antes da feature ir para produção — achados críticos e altos bloqueiam a liberação; médios/baixos podem ser registrados como dívida explícita e aceita, não ignorados silenciosamente.
