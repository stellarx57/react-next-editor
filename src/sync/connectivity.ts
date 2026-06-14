/**
 * Connectivity detection (§8.7). Listens to `online`/`offline` events but does
 * NOT trust `navigator.onLine` alone (it reports interface presence, not API
 * reachability); when a `ping` is provided, real reachability is confirmed
 * before reporting "online". Safe to construct in any environment.
 */
export interface ConnectivityOptions {
  /** Confirms real API reachability (e.g. a HEAD to the data API). */
  ping?: (signal?: AbortSignal) => Promise<boolean>;
  /** Polling interval in ms while running (default 30s). 0 disables polling. */
  intervalMs?: number;
  onChange?: (online: boolean) => void;
}

export class ConnectivityMonitor {
  private readonly ping?: (signal?: AbortSignal) => Promise<boolean>;
  private readonly intervalMs: number;
  private readonly onChange?: (online: boolean) => void;
  private online: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(options: ConnectivityOptions = {}) {
    this.ping = options.ping;
    this.intervalMs = options.intervalMs ?? 30_000;
    this.onChange = options.onChange;
    this.online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  isOnline(): boolean {
    return this.online;
  }

  private readonly handleOnline = () => void this.check();
  private readonly handleOffline = () => this.set(false);

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    if (this.intervalMs > 0) {
      this.timer = setInterval(() => void this.check(), this.intervalMs);
    }
    void this.check();
  }

  stop(): void {
    if (!this.started || typeof window === 'undefined') return;
    this.started = false;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Re-evaluate connectivity now, confirming reachability via ping when set. */
  async check(): Promise<boolean> {
    const navOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!navOnline) {
      this.set(false);
      return false;
    }
    if (!this.ping) {
      this.set(true);
      return true;
    }
    try {
      const reachable = await this.ping();
      this.set(reachable);
      return reachable;
    } catch {
      this.set(false);
      return false;
    }
  }

  private set(online: boolean): void {
    if (online !== this.online) {
      this.online = online;
      this.onChange?.(online);
    }
  }
}
