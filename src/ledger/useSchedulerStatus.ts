import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/services/api/client';
import { fetchSchedulerStatus, type SchedulerStatus } from './scheduler';

/** Local reads of the proxy's own snapshot are cheap, so it is re-read while the tab is visible. */
const REREAD_MS = 60_000;

// One request at a time per connection; a request from before a logout or server switch is
// never shared with, or committed by, the next connection.
let inFlight: { revision: number; request: Promise<SchedulerStatus | null> } | null = null;
const read = (revision: number) => {
  if (inFlight?.revision !== revision) {
    const request = fetchSchedulerStatus().finally(() => {
      if (inFlight?.request === request) inFlight = null;
    });
    inFlight = { revision, request };
  }
  return inFlight.request;
};

/**
 * The proxy's quota snapshot. `loaded` turns true after the first answer (even a failed one), so
 * callers can wait for it before deciding whether anything needs a direct provider read.
 */
export function useSchedulerStatus(enabled: boolean) {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Sticky: once this proxy has answered, Claude/Codex never fall back to direct provider reads,
  // even if a later read fails or a restarted proxy has not polled yet.
  const [supported, setSupported] = useState(false);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const revision = apiClient.getConnectionRevision();
    const next = await read(revision);
    if (!alive.current || revision !== apiClient.getConnectionRevision()) return;
    setStatus(next);
    setLoaded(true);
    if (next) setSupported(true);
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!enabled) return;
    void reload();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, REREAD_MS);
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, reload]);

  return { status, loaded, supported, reload };
}
