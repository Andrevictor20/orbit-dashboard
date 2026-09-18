import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { AppStoreCard } from '../../../components/appstore/AppStoreCard';
import type { AppStoreItem } from '../../../queries/useStoreAppsQuery';

const mockApp: AppStoreItem = {
  id: 'dkturbo',
  name: 'dkTurbo',
  description: 'Docker image accelerator, automatically test speed',
  icon: 'https://example.com/dkturbo.png',
  category: 'Productivity',
  store: 'play',
  architectures: ['amd64', 'arm64'],
};

describe('AppStoreCard', () => {
  it('renders app information, badges, and action buttons', () => {
    const onInstall = vi.fn();
    const onExplore = vi.fn();
    const onManage = vi.fn();
    const onOpenCustom = vi.fn();

    render(
      <AppStoreCard
        app={mockApp}
        index={0}
        isInstalled={false}
        installing={null}
        hostArch="x86_64"
        onInstall={onInstall}
        onExplore={onExplore}
        onManage={onManage}
        onOpenCustom={onOpenCustom}
      />
    );

    expect(screen.getByRole('heading', { name: 'dkTurbo' })).toBeInTheDocument();
    expect(screen.getByText(/Docker image accelerator/i)).toBeInTheDocument();
    expect(screen.getByText('Productivity')).toBeInTheDocument();
    expect(screen.getByText('play')).toBeInTheDocument();

    // Verify both action buttons
    const exploreBtn = screen.getByRole('button', { name: /explorar/i });
    expect(exploreBtn).toBeInTheDocument();

    const installBtn = screen.getByRole('button', { name: /^instalar$/i });
    expect(installBtn).toBeInTheDocument();
    expect(installBtn).not.toBeDisabled();

    // Verify click handlers
    fireEvent.click(installBtn);
    expect(onInstall).toHaveBeenCalledWith('dkturbo', 'dkTurbo');

    fireEvent.click(exploreBtn);
    expect(onExplore).toHaveBeenCalledWith('dkturbo');
  });

  it('renders "Gerenciar" button when app is already installed', () => {
    const onManage = vi.fn();
    render(
      <AppStoreCard
        app={mockApp}
        index={0}
        isInstalled={true}
        installing={null}
        onInstall={vi.fn()}
        onExplore={vi.fn()}
        onManage={onManage}
        onOpenCustom={vi.fn()}
      />
    );

    const manageBtn = screen.getByRole('button', { name: /gerenciar/i });
    expect(manageBtn).toBeInTheDocument();
    fireEvent.click(manageBtn);
    expect(onManage).toHaveBeenCalled();
  });
});
