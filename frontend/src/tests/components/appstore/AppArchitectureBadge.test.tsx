import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AppArchitectureBadge } from '../../../components/appstore/AppArchitectureBadge';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal: string) => defaultVal || key,
  }),
}));

describe('AppArchitectureBadge Component', () => {
  it('renders multi-arch badge in compact mode by default', () => {
    render(<AppArchitectureBadge architectures={['amd64', 'arm64']} mode="compact" />);
    expect(screen.getByTestId('arch-badge-multi')).toBeInTheDocument();
    expect(screen.getByText('x86 / ARM')).toBeInTheDocument();
  });

  it('renders only x86 warning badge when app lacks ARM support', () => {
    render(<AppArchitectureBadge architectures={['amd64']} mode="compact" />);
    expect(screen.getByTestId('arch-badge-only-x86')).toBeInTheDocument();
    expect(screen.getByText('x86_64')).toBeInTheDocument();
  });

  it('renders only ARM warning badge when app lacks x86 support', () => {
    render(<AppArchitectureBadge architectures={['arm64']} mode="compact" />);
    expect(screen.getByTestId('arch-badge-only-arm')).toBeInTheDocument();
    expect(screen.getByText('ARM64')).toBeInTheDocument();
  });

  it('renders incompatibility badge in compact mode when host is ARM and app is x86 only', () => {
    render(<AppArchitectureBadge architectures={['amd64']} hostArch="aarch64" mode="compact" />);
    expect(screen.getByTestId('arch-badge-incompatible')).toBeInTheDocument();
  });

  it('renders detailed pills and warning banner in detailed mode', () => {
    render(<AppArchitectureBadge architectures={['amd64']} mode="detailed" />);
    expect(screen.getByTestId('arch-detailed-view')).toBeInTheDocument();
    expect(screen.getByText('x86_64 (Intel / AMD)')).toBeInTheDocument();
    expect(screen.getByText('ARM64 (Raspberry Pi / ARM)')).toBeInTheDocument();
    expect(screen.getByText(/Aviso de Compatibilidade/i)).toBeInTheDocument();
  });
});
