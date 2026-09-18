# Saturn Dashboard v3.7.4

### Novidades, Correções e Melhorias na Versão 3.7.4

### 🚀 Arquitetura de Streaming & Miniaturas Inspirada em Jellyfin e Emby
- **Semáforo Global de Miniaturas (`THUMBNAIL_SEMAPHORE`):** Ao abrir pastas com dezenas de arquivos de mídia em HDs mecânicos externos USB, requisições paralelas concorrentes colapsavam a fila de I/O (teto de ~80–100 IOPS), gerando timeouts em cadeia e falhas nas miniaturas. Implementado semáforo assíncrono com limite de 2 tarefas simultâneas no FFmpeg, eliminando a sobrecarga de I/O no barramento USB.
- **Double-Checked Caching Ultra-Rápido:** Miniaturas já calculadas e presentes no cache em disco são entregues imediatamente em 0.1ms sem tocar no semáforo nem disputar a fila de concorrência.
- **Fast Keyframe Seek (`-noaccurate_seek`):** Aplicação de `-noaccurate_seek` antes de `-ss` e isolamento estrito de vídeo (`-map 0:V:0 -an -sn`), pulando instantaneamente para o keyframe mais próximo e gerando miniaturas em milissegundos mesmo em vídeos MKV de mais de 1.5 GB.

### 🎬 Live fMP4 Streaming & Downmix Estéreo Automático
- **Entrega Instantânea sem Buffer Morto (`-flush_packets 1`):** Adicionadas as flags `-flush_packets 1` e `-fflags +genpts+nobuffer -flags low_delay` no pipe do FFmpeg, garantindo que os cabeçalhos e pacotes fragmented MP4 cheguem continuamente ao navegador, eliminando o erro `MEDIA_ERR_DECODE`.
- **Downmixing de Áudio Surround 5.1/7.1 (`-ac 2 -ar 48000`):** Arquivos de vídeo e animes com áudio multicanal Opus ou FLAC 5.1/7.1 agora sofrem downmixing automático para estéreo (2 canais a 48kHz em AAC), resolvendo a falha de decodificação de áudio no player HTML5 do navegador.

### 💬 Resiliência Estendida de Legendas em Discos Lentos
- **Timeout de 15 Segundos no Probe:** Acomoda com segurança o tempo de spin-up de HDs externos USB em repouso.
- **Cache Condicionado:** O cache de legendas em disco é gravado exclusivamente quando faixas reais forem detectadas (`!subtitles.is_empty()`), prevenindo que leituras atrasadas gravem listas vazias permanentes.
