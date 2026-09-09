import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SambaModal } from '../../../components/files/SambaModal';

describe('SambaModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and displays Samba status and active shares', async () => {
    const mockStatus = {
      running: true,
      enabled: true,
      lan_ip: '192.168.1.100',
      active_shares: 1,
      smb_url_windows: '\\\\192.168.1.100',
      smb_url_mac: 'smb://192.168.1.100',
      workgroup: 'WORKGROUP',
    };

    const mockShares = [
      {
        name: 'public',
        path: '/DATA',
        read_only: false,
        guest_ok: true,
        comment: 'Orbit Shared Storage',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (url.toString().includes('/api/samba/status')) {
        return { ok: true, json: async () => mockStatus } as any;
      }
      if (url.toString().includes('/api/samba/shares')) {
        return { ok: true, json: async () => mockShares } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    render(<SambaModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Compartilhamento Samba \(SMB\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Servidor Samba: Ativo/i)).toBeInTheDocument();
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
      expect(screen.getByText('public')).toBeInTheDocument();
      expect(screen.getByText('/DATA — Orbit Shared Storage')).toBeInTheDocument();
    });
  });

  it('prefills folder information when folder is passed', async () => {
    const mockStatus = {
      running: false,
      enabled: false,
      lan_ip: '192.168.1.50',
      active_shares: 0,
      smb_url_windows: '\\\\192.168.1.50',
      smb_url_mac: 'smb://192.168.1.50',
      workgroup: 'WORKGROUP',
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (url.toString().includes('/api/samba/status')) {
        return { ok: true, json: async () => mockStatus } as any;
      }
      return { ok: true, json: async () => [] } as any;
    });

    const mockFolder = {
      id: '1',
      name: 'Filmes_HD',
      path: '/DATA/Filmes_HD',
      is_dir: true,
      size: 0,
      modified: '2026-09-09',
    };

    render(<SambaModal isOpen={true} folder={mockFolder as any} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Compartilhar Pasta: Filmes_HD/i)).toBeInTheDocument();
      const nameInput = screen.getByPlaceholderText(/ex: public, backups, filmes/i) as HTMLInputElement;
      expect(nameInput.value).toBe('filmes_hd');
      const pathInput = screen.getByPlaceholderText(/\/DATA ou caminho da pasta/i) as HTMLInputElement;
      expect(pathInput.value).toBe('/DATA/Filmes_HD');
    });
  });
});
