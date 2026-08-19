---
name: threat-modeling
description: "Modelagem de ameaças usando STRIDE e análise de trust boundaries."
---

# Threat Modeling

Antes de features de alto risco, analise:
- Assets e Actors.
- Trust boundaries e Data flows.
- Entry points e Attack surface.
- Aplique STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).
- O Threat Model deve gerar casos de teste de segurança que o `test-guardian` irá implementar (RED).
