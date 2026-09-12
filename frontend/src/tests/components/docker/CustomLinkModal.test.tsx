import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CustomLinkModal } from '../../../components/docker/container-list/CustomLinkModal';

describe('CustomLinkModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <CustomLinkModal
        isOpen={false}
        linkMode="builder"
        setLinkMode={vi.fn()}
        linkSubdomain=""
        setLinkSubdomain={vi.fn()}
        linkDomain="rasppi.cloud"
        setLinkDomain={vi.fn()}
        linkInput=""
        setLinkInput={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with container name and builder inputs when open', () => {
    render(
      <CustomLinkModal
        isOpen={true}
        linkMode="builder"
        setLinkMode={vi.fn()}
        linkSubdomain="meu-app"
        setLinkSubdomain={vi.fn()}
        linkDomain="rasppi.cloud"
        setLinkDomain={vi.fn()}
        linkInput=""
        setLinkInput={vi.fn()}
        containerName="meu-app-container"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Link Customizado do App/i)).toBeInTheDocument();
    expect(screen.getByText('(meu-app-container)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('meu-app')).toBeInTheDocument();
    expect(screen.getByDisplayValue('rasppi.cloud')).toBeInTheDocument();
  });

  it('renders Cloudflare Tunnel banner and fills inputs when "Usar Este Link" is clicked', () => {
    const setLinkInput = vi.fn();
    const setLinkSubdomain = vi.fn();
    const setLinkDomain = vi.fn();
    const setLinkMode = vi.fn();

    render(
      <CustomLinkModal
        isOpen={true}
        linkMode="builder"
        setLinkMode={setLinkMode}
        linkSubdomain=""
        setLinkSubdomain={setLinkSubdomain}
        linkDomain=""
        setLinkDomain={setLinkDomain}
        linkInput=""
        setLinkInput={setLinkInput}
        detectedCloudflareUrl="https://immich.rasppi.cloud"
        containerName="immich_server"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Link Cloudflare Tunnel:/i)).toBeInTheDocument();
    expect(screen.getByText('https://immich.rasppi.cloud')).toBeInTheDocument();

    const useLinkBtn = screen.getByRole('button', { name: /Usar Este Link/i });
    expect(useLinkBtn).toBeInTheDocument();

    fireEvent.click(useLinkBtn);

    expect(setLinkInput).toHaveBeenCalledWith('https://immich.rasppi.cloud');
    expect(setLinkSubdomain).toHaveBeenCalledWith('immich');
    expect(setLinkDomain).toHaveBeenCalledWith('rasppi.cloud');
    expect(setLinkMode).toHaveBeenCalledWith('builder');
  });

  it('calls onSave when "Salvar Link" button is clicked', () => {
    const onSave = vi.fn();
    render(
      <CustomLinkModal
        isOpen={true}
        linkMode="builder"
        setLinkMode={vi.fn()}
        linkSubdomain="nextcloud"
        setLinkSubdomain={vi.fn()}
        linkDomain="rasppi.cloud"
        setLinkDomain={vi.fn()}
        linkInput=""
        setLinkInput={vi.fn()}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    const saveBtn = screen.getByRole('button', { name: /Salvar Link/i });
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when "Cancelar" or close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <CustomLinkModal
        isOpen={true}
        linkMode="builder"
        setLinkMode={vi.fn()}
        linkSubdomain=""
        setLinkSubdomain={vi.fn()}
        linkDomain=""
        setLinkDomain={vi.fn()}
        linkInput=""
        setLinkInput={vi.fn()}
        onSave={vi.fn()}
        onClose={onClose}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByLabelText(/Fechar/i);
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
