import type { ProviderFlowState } from './hooks/useOAuthFlows';

export type FlowView = 'idle' | 'flow' | 'success' | 'failed';





export const resolveFlowView = (state: ProviderFlowState): FlowView => {
  if (state.status === 'success') return 'success';
  if (state.url || state.status === 'waiting') return 'flow';
  if (state.status === 'error') return 'failed';
  return 'idle';
};


export const splitAuthUrl = (url: string): { host: string; rest: string } => {
  try {
    const { host } = new URL(url);
    if (!host) return { host: '', rest: url };
    const hostEnd = url.indexOf(host) + host.length;
    return { host, rest: url.slice(hostEnd) };
  } catch {
    return { host: '', rest: url };
  }
};
