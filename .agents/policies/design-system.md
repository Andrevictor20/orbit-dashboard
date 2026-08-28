# Design System Policy

- **Reutilização & Tokens Semânticos**: Reutilize tokens semânticos (`color.background`, `color.accent`, `radius.inner`) em vez de valores arbitrários e hardcoded espalhados.
- **Color Consistency Lock**: Acento único de cor com saturação < 80%, aplicado de forma consistente por toda a página. Proibida a paleta clichê de IA (bege/latão/espresso) como default para produtos premium.
- **Shape Consistency Lock & Raios Concêntricos**: A escala de bordas deve ser consistente e aplicar a matemática concêntrica em molduras aninhadas ($\text{radius}_{\text{inner}} = \text{radius}_{\text{outer}} - \text{padding}$).
- **Adoção Honesta de Design Systems Oficiais**: Para interfaces corporativas ou de ecossistemas específicos (Fluent, Material 3, Carbon, Polaris, Primer, Radix Themes), utilize os pacotes oficiais. Não recrie CSS por aproximação manual sem necessidade.
- **Prevenção Ativa de Drift**: Novos componentes devem seguir os padrões estruturais aprovados (Double-Bezel, Bento Diversity, Button-in-Button) e ser devidamente registrados no component registry.
