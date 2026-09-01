import { render, screen } from '@testing-library/react';
import { BatchUpdateModal } from '../../../components/docker/BatchUpdateModal';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    }
  ];

  const mockUpdatesMap = {
    c1: { has_update: true }
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <BatchUpdateModal
        isOpen={false}
        onClose={mockOnClose}
        containers={mockContainers}
        updatesMap={mockUpdatesMap}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders modal when open', () => {
    render(
      <BatchUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        containers={mockContainers}
        updatesMap={mockUpdatesMap}
      />
    );
    expect(screen.getByText('nginx-proxy')).toBeTruthy();
  });
});
