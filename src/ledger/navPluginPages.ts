/**
 * Plugin resource pages for the ledger sidebar, discovered the same way as MainLayout's: list the
 * plugins and collect their menu entries, and reload when the plugins change.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  collectPluginResourceEntries,
  PLUGIN_RESOURCES_REFRESH_EVENT,
  type PluginResourceEntry,
} from '@/features/plugins/pluginResources';
import { pluginsApi } from '@/services/api';
import { useAuthStore } from '@/stores';

export function usePluginPageEntries(): PluginResourceEntry[] {
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const supportsPlugin = useAuthStore((state) => state.supportsPlugin);
  const apiBase = useAuthStore((state) => state.apiBase);
  const [entries, setEntries] = useState<PluginResourceEntry[]>([]);

  const load = useCallback(async () => {
    if (connectionStatus !== 'connected' || !supportsPlugin) {
      setEntries([]);
      return;
    }
    try {
      const plugins = await pluginsApi.list();
      setEntries(collectPluginResourceEntries(plugins.plugins));
    } catch {
      setEntries([]);
    }
  }, [connectionStatus, supportsPlugin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    window.addEventListener(PLUGIN_RESOURCES_REFRESH_EVENT, load);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(PLUGIN_RESOURCES_REFRESH_EVENT, load);
    };
  }, [apiBase, load]);

  return entries;
}
