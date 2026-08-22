import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';

describe('useWebSocket Hook', () => {
  let mockWebSocket: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockWebSocket = {
      close: vi.fn(),
      send: vi.fn(),
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
    };

    const mockWebSocketConstructor = vi.fn();
    global.WebSocket = class {
      constructor(url: string) {
        mockWebSocketConstructor(url);
        return mockWebSocket;
      }
    } as any;
    
    // Attach constructor mock to global to assert on it later
    (global as any).mockWebSocketConstructor = mockWebSocketConstructor;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('initializes with disconnected state and null stats', () => {
    const { result } = renderHook(() => useWebSocket('/api/stats'));
    
    expect(result.current.isConnected).toBe(false);
    expect(result.current.stats).toBeNull();
    expect((global as any).mockWebSocketConstructor).toHaveBeenCalledWith(expect.stringContaining('/api/stats'));
  });

  it('updates isConnected when websocket opens', () => {
    const { result } = renderHook(() => useWebSocket('/api/stats'));
    
    act(() => {
      mockWebSocket.onopen();
    });
    
    expect(result.current.isConnected).toBe(true);
  });

  it('parses incoming websocket messages and updates stats', () => {
    const { result } = renderHook(() => useWebSocket('/api/stats'));
    
    act(() => {
      mockWebSocket.onopen();
    });

    const mockStats = { cpu_usage: 50.5, memory_used: 1024 };
    
    act(() => {
      mockWebSocket.onmessage({ data: JSON.stringify(mockStats) });
    });
    
    expect(result.current.stats).toEqual(mockStats);
  });

  it('handles invalid json payload gracefully', () => {
    const { result } = renderHook(() => useWebSocket('/api/stats'));
    
    act(() => {
      mockWebSocket.onmessage({ data: 'invalid-json' });
    });
    
    // Stats remain null, doesn't throw — parse errors are silently discarded
    expect(result.current.stats).toBeNull();
  });

  it('reconnects after 3 seconds on close', () => {
    renderHook(() => useWebSocket('/api/stats'));
    
    expect((global as any).mockWebSocketConstructor).toHaveBeenCalledTimes(1);

    act(() => {
      mockWebSocket.onclose();
    });

    // Should not reconnect immediately
    expect((global as any).mockWebSocketConstructor).toHaveBeenCalledTimes(1);

    // Fast-forward 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect((global as any).mockWebSocketConstructor).toHaveBeenCalledTimes(2); // reconnected!
  });

  it('closes on error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useWebSocket('/api/stats'));
    
    act(() => {
      mockWebSocket.onerror(new Error('ws error'));
    });
    
    expect(mockWebSocket.close).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket('/api/stats'));
    
    unmount();
    
    expect(mockWebSocket.close).toHaveBeenCalled();
  });
});
