import { getBackendSrv } from '@grafana/runtime';

interface DashboardViewsResponse {
  dashboardUids: string[];
}

export async function fetchDashboardViews(limit = 50): Promise<string[]> {
  const response = await getBackendSrv().get<DashboardViewsResponse>('/api/user/dashboard-views', { limit });
  return response.dashboardUids ?? [];
}

export async function recordDashboardView(dashboardUID: string): Promise<void> {
  await getBackendSrv().post(`/api/user/dashboard-views/dashboard/uid/${dashboardUID}`);
}

export async function clearDashboardViews(): Promise<void> {
  await getBackendSrv().delete('/api/user/dashboard-views');
}
