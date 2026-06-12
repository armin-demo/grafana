import { getBackendSrv } from '@grafana/runtime';
import impressionSrv from 'app/core/services/impression_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';

interface LatestViewedDashboardDTO {
  uid?: string;
}

export async function getLatestViewedDashboard(): Promise<DashboardQueryResult | undefined> {
  const latestViewed = await getBackendSrv().get<LatestViewedDashboardDTO>('/api/dashboards/latest-viewed');
  if (!latestViewed.uid) {
    return undefined;
  }

  const searchResults = await getGrafanaSearcher().search({
    kind: ['dashboard'],
    limit: 1,
    uid: [latestViewed.uid],
  });

  return searchResults.view.toArray()[0];
}

/**
 * Returns dashboard search results ordered the same way the user opened them.
 */
export async function getRecentlyViewedDashboards(maxItems = 5): Promise<DashboardQueryResult[]> {
  try {
    const recentlyOpened = (await impressionSrv.getDashboardOpened()).slice(0, maxItems);
    if (!recentlyOpened.length) {
      return [];
    }

    const searchResults = await getGrafanaSearcher().search({
      kind: ['dashboard'],
      limit: recentlyOpened.length,
      uid: recentlyOpened,
    });

    const dashboards = searchResults.view.toArray();
    // Keep dashboards in the same order the user opened them.
    // When a UID is missing from the search response
    // push it to the end instead of letting indexOf return -1
    const order = (uid: string) => {
      const idx = recentlyOpened.indexOf(uid);
      return idx === -1 ? recentlyOpened.length : idx;
    };

    dashboards.sort((a, b) => order(a.uid) - order(b.uid));
    return dashboards;
  } catch (error) {
    console.error('Failed to load recently viewed dashboards', error);
    return [];
  }
}
