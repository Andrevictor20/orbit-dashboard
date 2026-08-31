import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DockerInstallModal } from '../../../components/docker/DockerInstallModal';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockStartInstall = vi.fn();
vi.mock('../../../contexts/InstallContext', () => ({
  useInstall: () => ({
    startInstall: mockStartInstall,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('DockerInstallModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <DockerInstallModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with title and input area when isOpen is true', () => {
    render(<DockerInstallModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Instalar via Docker Run ou Compose')).toBeTruthy();
    expect(screen.getByPlaceholderText(/docker run -d/)).toBeTruthy();
    expect(screen.getByText('Instalar Container')).toBeTruthy();
  });

  it('parses input and displays extracted service details and port conflict', async () => {
    const mockParseResponse = {
      input_type: 'docker_run',
      app_name: 'test-nginx',
      image: 'nginx:alpine',
      services: [
        {
          name: 'test-nginx',
          image: 'nginx:alpine',
          ports: [{ host_port: 8080, container_port: 80, protocol: 'tcp', raw: '8080:80' }],
          volumes: [{ host_path: './data', container_path: '/data', raw: './data:/data' }],
          environment: { TZ: 'UTC' },
          privileged: false
        }
      ],
      compose_yaml: 'services:\n  test-nginx:\n    image: nginx:alpine',
      port_conflicts: [
        {
          host_port: 8080,
          container_port: 80,
          protocol: 'tcp',
          in_use: true,
          in_use_by: "Container 'traefik'",
          suggested_port: 8081
        }
      ]
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockParseResponse
    });

    render(<DockerInstallModal isOpen={true} onClose={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/docker run -d/);
    fireEvent.change(textarea, {
      target: { value: 'docker run -d --name test-nginx -p 8080:80 nginx:alpine' }
    });

    await waitFor(() => {
      expect(screen.getByText('Docker Run CLI')).toBeTruthy();
      expect(screen.getByDisplayValue('test-nginx')).toBeTruthy();
      expect(screen.getByText(/1 porta\(s\) em conflito/)).toBeTruthy();
      expect(screen.getByText(/Usar sugestão \(8081\)/)).toBeTruthy();
    });
  });

  it('triggers install call with port overrides when install button is clicked', async () => {
    const mockParseResponse = {
      input_type: 'docker_run',
      app_name: 'my-app',
      image: 'nginx:alpine',
      services: [
        {
          name: 'my-app',
          image: 'nginx:alpine',
          ports: [{ host_port: 8080, container_port: 80, protocol: 'tcp', raw: '8080:80' }],
          volumes: [],
          environment: {},
          privileged: false
        }
      ],
      compose_yaml: 'services:\n  my-app:\n    image: nginx:alpine',
      port_conflicts: [
        {
          host_port: 8080,
          container_port: 80,
          protocol: 'tcp',
          in_use: false,
          suggested_port: 8080
        }
      ]
    };

    (globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockParseResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: 'task-1234', app_name: 'my-app' })
      });

    const mockOnClose = vi.fn();
    render(<DockerInstallModal isOpen={true} onClose={mockOnClose} />);

    const textarea = screen.getByPlaceholderText(/docker run -d/);
    fireEvent.change(textarea, {
      target: { value: 'docker run -d --name my-app -p 8080:80 nginx:alpine' }
    });

    await waitFor(() => {
      expect(screen.getByText('Portas disponíveis')).toBeTruthy();
    });

    const installBtn = screen.getByText('Instalar Container');
    fireEvent.click(installBtn);

    await waitFor(() => {
      expect(mockStartInstall).toHaveBeenCalledWith('task-1234', 'my-app');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
