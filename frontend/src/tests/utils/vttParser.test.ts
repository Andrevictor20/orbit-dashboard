import { describe, it, expect } from 'vitest';
import { parseWebVtt, formatVideoTime, convertTextToVttBlob } from '../../utils/vttParser';

describe('vttParser utility', () => {
  it('parses standard WebVTT cues correctly', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Olá Mundo!

2
00:00:05.500 --> 00:00:08.200
Segunda linha de legenda
`;
    const cues = parseWebVtt(vtt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({
      start: 1,
      end: 4,
      text: 'Olá Mundo!',
    });
    expect(cues[1]).toEqual({
      start: 5.5,
      end: 8.2,
      text: 'Segunda linha de legenda',
    });
  });

  it('strips HTML tags and ASS/SSA tags from cues', () => {
    const vtt = `WEBVTT

00:01:10.000 --> 00:01:15.000
{\\an8}<i>Texto com estilo</i> e {\\b1}negrito{\\b0}
`;
    const cues = parseWebVtt(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Texto com estilo e negrito');
    expect(cues[0].start).toBe(70);
    expect(cues[0].end).toBe(75);
  });

  it('formats video time in seconds to mm:ss or hh:mm:ss', () => {
    expect(formatVideoTime(0)).toBe('0:00');
    expect(formatVideoTime(65)).toBe('1:05');
    expect(formatVideoTime(3665)).toBe('1:01:05');
    expect(formatVideoTime(NaN)).toBe('0:00');
    expect(formatVideoTime(-5)).toBe('0:00');
  });

  it('converts SRT format to WebVTT blob', async () => {
    const srt = `1
00:00:01,500 --> 00:00:03,000
Legenda SRT
`;
    const blob = convertTextToVttBlob(srt);
    expect(blob.type).toBe('text/vtt');
    const text = await blob.text();
    expect(text).toContain('WEBVTT');
    expect(text).toContain('00:00:01.500 --> 00:00:03.000');
  });
});
