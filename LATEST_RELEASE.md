# Saturn Dashboard v3.7.10

### Novidades, Correções e Melhorias na Versão 3.7.10

### 🎬 Arquitetura Híbrida de Streaming & Remux Direto Ultra-Rápido
- **Remux Direto por Padrão (`-c:v copy` com FourCC `hvc1`):** Arquivos MKV com vídeo H.264/H.265 (HEVC) e áudio AAC/Opus agora são transmitidos por remux direto instantâneo, eliminando a re-codificação de vídeo por software no servidor. O uso de CPU no Raspberry Pi despenca de 400% (4 núcleos em 100%) para **menos de 1%**, com velocidade de processamento saltando de 0.2x para mais de 2000x e início de reprodução em menos de 200ms.
- **Etiqueta FourCC `hvc1` para Compatibilidade Web:** O backend do Saturn agora injeta automaticamente a flag `-tag:v hvc1` nos fluxos HEVC/H.265 para contêiner MP4 fragmentado, permitindo que navegadores modernos (Chrome, Edge, Safari) ativem diretamente a decodificação nativa por GPU do cliente.
- **Fallback Automático Inteligente (Watchdog de 7 Segundos):** Se o navegador do cliente não possuir decodificador de hardware para o perfil específico e o vídeo permanecer travado em buffering por mais de 7 segundos, o Saturn exibe automaticamente uma interface de recuperação em tons de alerta com opções claras: abrir diretamente no VLC com 1 clique (`vlc://...`), tentar novamente ou forçar transcodificação por software.
- **Alternador de Modo no Cabeçalho (Remux vs Transcode):** Adicionado badge interativo no cabeçalho do player exibindo o status em tempo real (`⚡ Remux Direto (0% CPU)` vs `🔄 Transcode (CPU)`), permitindo alternar manualmente o modo de reprodução a qualquer momento.
- **Throttling Seguro na Transcodificação Forçada:** Quando a transcodificação por software é explicitamente solicitada (`mode=transcode`), o FFmpeg é configurado com limites seguros (`-threads 2 -crf 25`) para impedir aquecimento excessivo e thermal throttling da CPU no Raspberry Pi.
- **Refatoração Modular do Player:** Extraído o hook `useVideoSubtitles` para isolamento de lógica de legendas VTT/SRT e sincronização de cues, mantendo todos os componentes rigorosamente abaixo do limite de 500 linhas (*No God Files*).
