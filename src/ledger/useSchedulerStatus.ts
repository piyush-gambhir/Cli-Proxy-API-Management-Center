import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/services/api/client';
import { fetchSchedulerStatus, type SchedulerStatus } from './scheduler';


const REREAD_MS = 60_000;



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





export function useSchedulerStatus(enabled: boolean) {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loaded, setLoaded] = useState(false);


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
