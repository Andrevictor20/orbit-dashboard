import { render, screen } from '@testing-library/react';
import { DiskAnalyzer } from '../../pages/DiskAnalyzer';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

class MockEventSource {
  onmessage: any;
  onerror: any;
  constructor(_url: string) {}
  addEventListener(_event: string, _cb: any) {}
  close() {}
}
globalThis.EventSource = MockEventSource as any;

describe('DiskAnalyzer Page Component', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([])
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('renders disk analyzer shell', () => {
    render(<MemoryRouter><DiskAnalyzer /></MemoryRouter>);
    expect(screen.getByText(/Analisador de Espaço em Disco/i)).toBeTruthy();
  });
});
