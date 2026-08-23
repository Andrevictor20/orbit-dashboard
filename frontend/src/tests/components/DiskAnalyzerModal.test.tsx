import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DiskAnalyzerModal } from '../../components/files/DiskAnalyzerModal';

describe('DiskAnalyzerModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state then analysis data correctly', async () => {
    const mockData = {
      path: '/home',
      total_size: 1024 * 1024 * 500, // 500 MB
      item_count: 2,
      items: [
        {
          name: 'large_folder',
          path: '/home/large_folder',
          is_dir: true,
          size: 1024 * 1024 * 350,
          percentage: 70.0,
        },
        {
          name: 'video.mp4',
          path: '/home/video.mp4',
          is_dir: false,
          size: 1024 * 1024 * 150,
          percentage: 30.0,
        },
      ],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));

    render(
      <DiskAnalyzerModal
        currentPath="/home"
        isOpen={true}
        onClose={vi.fn()}
        onNavigateTo={vi.fn()}
      />
    );

    expect(screen.getByText('Analisador de Espaço em Disco')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('large_folder')).toBeInTheDocument();
      expect(screen.getByText('video.mp4')).toBeInTheDocument();
      expect(screen.getByText('70.0%')).toBeInTheDocument();
      expect(screen.getByText('30.0%')).toBeInTheDocument();
    });
  });
});
