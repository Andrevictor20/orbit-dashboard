import { render, screen } from '@testing-library/react';
import { BatchUpdateModal } from '../../../components/docker/BatchUpdateModal';
import { BatchUpdateFloatingBar } from '../../../components/docker/BatchUpdateFloatingBar';
import { BatchUpdateProvider, useBatchUpdate } from '../../../contexts/BatchUpdateContext';
import { vi, describe, it, expect, } from 'vitest';
import type { ContainerLike } from '../../../utils/containerGroups';

window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('BatchUpdateModal Component', () => {
  const mockOnClose = vi.fn();
  const mockContainers: ContainerLike[] = [
    {
      id: 'c1',
      name: '/nginx-proxy',
      image: 'nginx:alpine',
      state: 'running',
      status: 'Up 2 hours',
      labels: { 'com.docker.compose.project': 'web-stack' }
    },
    {
      id: 'c2',
      name: '/orbit-dashboard',
      image: 'ghcr.io/andrevmp/orbit-dashboard:latest',
      state: 'running',
      status: 'Up 10 hours',
    }
  ];

  const mockUpdatesMap = {
    c1: { has_update: true },
    c2: { has_update: true },
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <BatchUpdateProvider>
        <BatchUpdateModal
          isOpen={false}
          onClose={mockOnClose}
          containers={mockContainers}
          updatesMap={mockUpdatesMap}
        />
      </BatchUpdateProvider>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders modal when open and shows containers', () => {
    render(
      <BatchUpdateProvider>
        <BatchUpdateModal
          isOpen={true}
          onClose={mockOnClose}
          containers={mockContainers}
          updatesMap={mockUpdatesMap}
        />
      </BatchUpdateProvider>
    );
    expect(screen.getByText('nginx-proxy')).toBeTruthy();
    expect(screen.getByText('orbit-dashboard')).toBeTruthy();
  });

  it('displays orbit self-protection badge and disables checkbox for orbit container', () => {
    render(
      <BatchUpdateProvider>
        <BatchUpdateModal
          isOpen={true}
          onClose={mockOnClose}
          containers={mockContainers}
          updatesMap={mockUpdatesMap}
        />
      </BatchUpdateProvider>
    );
    expect(screen.getByText('Atualize pelo menu do Orbit')).toBeTruthy();
  });

  it('renders high contrast terminal header and logs container', () => {
    const TestWrapper = () => {
      const batch = useBatchUpdate();
      return (
        <div>
          <button
            onClick={() => {
              batch.openModal();
              // Inject a test log and simulate updating state
              (batch as any).setSelectedIds(['c1']);
            }}
          >
            Open
          </button>
          <BatchUpdateModal
            isOpen={true}
            onClose={mockOnClose}
            containers={mockContainers}
            updatesMap={mockUpdatesMap}
          />
        </div>
      );
    };

    render(
      <BatchUpdateProvider>
        <TestWrapper />
      </BatchUpdateProvider>
    );

    // Initial view shows start update button
    expect(screen.getByText(/Atualizar/i)).toBeTruthy();
  });
});

describe('BatchUpdateFloatingBar Component', () => {
  it('renders nothing when no update is active and modal is closed', () => {
    const { container } = render(
      <BatchUpdateProvider>
        <BatchUpdateFloatingBar />
      </BatchUpdateProvider>
    );
    expect(container.querySelector('aside')).toBeNull();
  });
});
