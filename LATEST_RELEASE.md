# Saturn Dashboard v3.7.3

### Novidades, Correções e Melhorias na Versão 3.7.3

### 🎬 Reprodução Fluida de Vídeos MKV & Remuxing em Tempo Real
- **Remuxing Inteligente para fMP4:** Implementada inspeção prévia de streams via `ffprobe`. Vídeos em contêineres Matroska (`.mkv`) com codec H.264 8-bit são remuxados em tempo real com `-c:v copy`, resultando em **0% de uso de CPU**, velocidade superior a **500x** e início instantâneo de reprodução no navegador.
- **Transcodificação Dinâmica:** Vídeos em H.264 10-bit (Hi10P) ou HEVC/AV1 são transcodificados sob demanda com preset ultrarrápido (`-preset ultrafast -tune zerolatency -pix_fmt yuv420p`), garantindo compatibilidade total com Chromium, Firefox e Safari.
- **Mapeamento Estrito de Streams:** Mapeamento explícito de `-map 0:v:0 -map 0:a:0?` no FFmpeg, descartando trilhas de anexo e legendas de texto que causavam quebras no empacotador MP4.
- **Busca Rápida por Keyframe:** Suporte ao parâmetro `?start=SS` antes do input do FFmpeg (`-ss {start} -i {path}`), viabilizando avanço e retrocesso instantâneo na barra de reprodução.

### 💬 Resiliência e Extração Otimizada de Legendas
- **Suporte a HDs Externos em Repouso (Spin-up):** Timeout de sondagem do `ffprobe` estendido de 2s para 10s, permitindo que discos externos USB girem os pratos sem causar falso erro.
- **Eliminação de Cache Falso:** O Saturn não grava mais listas vazias no cache em caso de erro transitório de I/O, garantindo que as legendas apareçam assim que o disco responder.
- **Extração Acelerada (`-vn -an`):** Ignora completamente o processamento de vídeo e áudio durante a extração de legendas WebVTT, reduzindo o tempo de resposta em arquivos grandes de anime de mais de 15s para menos de 1 segundo.
- **Higienização de Tags ASS/SSA:** Limpeza de tags de posicionamento e formatação de animes (`{\an8}`, `\N`), entregando texto claro e bem posicionado.

### 👁️ Engine Visual de Legendas (`SubtitleOverlay`)
- **Overlay de Alto Contraste:** Componente visual dedicado com sombra profunda de alto contraste, garantindo leitura perfeita sobre qualquer fundo ou cena de alta luminosidade.
- **Sincronização Direta com o Player:** Parser WebVTT nativo sincronizado diretamente pelo evento `timeupdate`, eliminando falhas de renderização da tag `<track>` do navegador.
- **Inicialização Automática para MKV:** Vídeos com extensão `.mkv` iniciam diretamente no fluxo compatível, sem exigir cliques manuais no botão de modo compatibilidade.

### 🗂️ Resiliência no Gerenciador de Arquivos
- **Prevenção de Falsos 404:** O gerenciador de arquivos preserva estritamente o caminho atual (`currentPath`) em caso de erros transitórios de rede ou timeout, eliminando o redirecionamento acidental para a raiz (`/`).
- **Teardown Estrito de Sockets:** Desmontagem imediata de elementos `<video>` ao fechar o player, liberando conexões do pool HTTP/1.1 do Chromium e evitando o travamento de requisições subsequentes.
