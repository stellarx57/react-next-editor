import { describe, expect, it, vi } from 'vitest';
import { ConnectivityMonitor } from './connectivity';

describe('ConnectivityMonitor', () => {
  it('confirms reachability via ping rather than trusting navigator.onLine alone', async () => {
    const onChange = vi.fn();
    const monitor = new ConnectivityMonitor({
      ping: async () => false,
      intervalMs: 0,
      onChange,
    });
    // navigator.onLine is true in jsdom, but the ping says the API is unreachable.
    const online = await monitor.check();
    expect(online).toBe(false);
    expect(monitor.isOnline()).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('reports online when the ping succeeds', async () => {
    const monitor = new ConnectivityMonitor({ ping: async () => true, intervalMs: 0 });
    expect(await monitor.check()).toBe(true);
    expect(monitor.isOnline()).toBe(true);
  });

  it('treats a throwing ping as offline', async () => {
    const monitor = new ConnectivityMonitor({
      ping: async () => {
        throw new Error('network');
      },
      intervalMs: 0,
    });
    expect(await monitor.check()).toBe(false);
  });

  it('only fires onChange on actual transitions', async () => {
    const onChange = vi.fn();
    let reachable = true;
    const monitor = new ConnectivityMonitor({
      ping: async () => reachable,
      intervalMs: 0,
      onChange,
    });
    await monitor.check(); // true (no change from initial true) → no fire
    await monitor.check(); // still true → no fire
    reachable = false;
    await monitor.check(); // → fire(false)
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
