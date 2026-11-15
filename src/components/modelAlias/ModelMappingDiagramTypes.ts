export interface AuthFileModelItem {
  id: string;
  display_name?: string;
  type?: string;
  owned_by?: string;
}

export interface SourceNode {
  id: string;
  provider: string;
  name: string;
  aliases: { alias: string; fork: boolean }[];
}

export interface AliasNode {
  id: string;
  alias: string;
  sources: SourceNode[];
}

export interface ProviderNode {
  provider: string;
  sources: SourceNode[];
}

export interface ContextMenuState {
  x: number;
  y: number;
  type: 'alias' | 'background' | 'provider' | 'source';
  data?: string;
}

export type DiagramLine = { path: string; color: string; id: string };
