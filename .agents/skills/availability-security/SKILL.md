---
name: availability-security
description: "Proteção contra DoS e esgotamento de recursos."
---

# Availability Security

Detecte e proteja a aplicação contra:
- **Request flooding**: Múltiplas requisições, burst, concorrência abusiva.
- **Resource exhaustion**: Payloads/JSON gigantes, paginação ilimitada, queries caras, regex catastrófica.
- Não confunda Application DoS (rate limit, throttling) com Infrastructure DDoS (WAF, CDN, autoscaling).
- Proteja endpoints sensíveis e pesados com timeouts e limites estritos.
