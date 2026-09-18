export interface SubtitleCue {
  id?: string;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

function parseVttTime(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (parts.length === 3) {
    hours = parseFloat(parts[0]) || 0;
    minutes = parseFloat(parts[1]) || 0;
    seconds = parseFloat(parts[2]) || 0;
  } else if (parts.length === 2) {
    minutes = parseFloat(parts[0]) || 0;
    seconds = parseFloat(parts[1]) || 0;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseWebVtt(vttContent: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  if (!vttContent) return cues;

  const lines = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.includes('-->')) {
      const parts = line.split('-->');
      if (parts.length === 2) {
        const start = parseVttTime(parts[0]);
        const endPart = parts[1].trim().split(/\s+/)[0];
        const end = parseVttTime(endPart);

        let text = '';
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          text += (text ? '\n' : '') + lines[i].trim();
          i++;
        }

        if (text && end > start) {
          const cleanText = text
            .replace(/<[^>]*>/g, '') // remove HTML tags
            .replace(/\{[^}]*\}/g, '') // remove ASS tags
            .replace(/\\N/g, '\n');
          cues.push({ start, end, text: cleanText });
        }
      }
    }
    i++;
  }

  return cues;
}

export function formatVideoTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function convertTextToVttBlob(text: string): Blob {
  const vttContent = text.includes('WEBVTT') 
    ? text 
    : `WEBVTT\n\n${text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;
  return new Blob([vttContent], { type: 'text/vtt' });
}
