import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StackGridCard } from '../../../components/docker/container-list/StackGridCard';
import type { GroupContainerItem } from '../../../utils/containerGroups';

describe('StackGridCard Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockContainer1 = {
    id: 'c11111111111',
    name: 'ar_saude_web',
    image: 'ar-saude/web:latest',
    state: 'running',
    status: 'Up 5 hours',
    cpu_percent: 1.5,
    memory_used: 200 * 1024 * 1024,
    ports: [{ private_port: 3000, public_port: 3000, typ: 'tcp' }],
  };

  const mockContainer2 = {
    id: 'c22222222222',
    name: 'ar_saude_db',
    image: 'postgres:15-alpine',
    state: 'running',
    status: 'Up 5 hours',
    cpu_percent: 0.8,
    memory_used: 120 * 1024 * 1024,
    ports: [{ private_port: 5432, typ: 'tcp' }],
  };

  const mockGroup: GroupContainerItem = {
    id: 'group:ar_saude',
    groupKey: 'stack:ar_saude',
    name: 'Ar Saude',
    type: 'group',
    iconUrl: '/icons/ar_saude.png',
    primaryContainer: mockContainer1,
    totalCount: 2,
    runningCount: 2,
    allRunning: true,
    anyRunning: true,
    totalCpu: 2.3,
    totalMemory: 320 * 1024 * 1024,
    totalDisk: 500 * 1024 * 1024,
    webContainers: [mockContainer1],
    containers: [mockContainer1, mockContainer2],
  };

  it('renders stack name and metrics without update badge when no updates are available', () => {
    render(
      <StackGridCard
        group={mockGroup}
        actionLoading={null}
        updatesMap={{}}
        onOpenGroupModal={vi.fn()}
        onOpenPrimarySelector={vi.fn()}
        onGroupAction={vi.fn()}
      />
    );

    expect(screen.getByText('Ar Saude')).toBeInTheDocument();
    expect(screen.getByText('Stack (2 containers)')).toBeInTheDocument();
    expect(screen.queryByTitle(/container\(s\) com atualização disponível/)).not.toBeInTheDocument();
  });

  it('renders update badge with count and triggers modal on click when updates are available', () => {
    const onOpenGroupModal = vi.fn();
    const updatesMap = {
      'c11111111111': { image: 'ar-saude/web:latest', has_update: true },
    };

    render(
      <StackGridCard
        group={mockGroup}
        actionLoading={null}
        updatesMap={updatesMap}
        onOpenGroupModal={onOpenGroupModal}
        onOpenPrimarySelector={vi.fn()}
        onGroupAction={vi.fn()}
      />
    );

    const updateBadge = screen.getByTitle(/1 container\(s\) com atualização disponível/);
    expect(updateBadge).toBeInTheDocument();
    expect(updateBadge).toHaveTextContent(/Atualizar \(1\)/);

    fireEvent.click(updateBadge);
    expect(onOpenGroupModal).toHaveBeenCalledWith(mockGroup);
  });
});
