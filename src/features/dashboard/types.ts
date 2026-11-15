import type { RecentRequestBucket } from '@/utils/recentRequests';


export const TRAFFIC_BUCKET_MINUTES = 10;


export interface TrafficWindow {
  buckets: RecentRequestBucket[];
  totalSuccess: number;
  totalFailure: number;
  total: number;

  successRate: number | null;

  peakTotal: number;

  peakIndex: number;

  windowMinutes: number;
}


export interface ProviderTraffic {
  id: string;
  credentials: number;
  success: number;
  failure: number;
  total: number;
  successRate: number | null;
  buckets: RecentRequestBucket[];
}


export interface CredentialHealth {
  total: number;
  active: number;
  disabled: number;
  unavailable: number;

  byType: Array<{ type: string; count: number }>;
}


export interface DashboardCounts {
  managementKeys: number | null;
  providerKeys: number | null;
  credentials: number | null;
  models: number | null;
}
