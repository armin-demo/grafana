import { filter, isArray, isNumber, isString } from 'lodash';

import { store } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import {
  clearDashboardViews,
  fetchDashboardViews,
  recordDashboardView,
} from '../../features/browse-dashboards/api/dashboardViewsApi';
import { contextSrv } from './context_srv';

export class ImpressionSrv {
  constructor() {}

  addDashboardImpression(dashboardUID: string) {
    const impressionsKey = this.impressionKey();
    let impressions: string[] = [];
    if (store.exists(impressionsKey)) {
      impressions = JSON.parse(store.get(impressionsKey));
      if (!isArray(impressions)) {
        impressions = [];
      }
    }

    impressions = impressions.filter((imp) => {
      return dashboardUID !== imp;
    });

    impressions.unshift(dashboardUID);

    if (impressions.length > 50) {
      impressions.pop();
    }
    store.set(impressionsKey, JSON.stringify(impressions));

    if (contextSrv.isSignedIn) {
      recordDashboardView(dashboardUID).catch(() => {
        // Keep local impressions when the backend is unavailable.
      });
    }
  }

  private async convertToUIDs() {
    let impressions = this.getImpressions();
    const ids = filter(impressions, (el) => isNumber(el));
    if (!ids.length) {
      return;
    }

    const convertedUIDs = await getBackendSrv().get<string[]>(`/api/dashboards/ids/${ids.join(',')}`);
    store.set(this.impressionKey(), JSON.stringify([...filter(impressions, (el) => isString(el)), ...convertedUIDs]));
  }

  private getImpressions() {
    const impressions = store.get(this.impressionKey()) || '[]';

    return JSON.parse(impressions);
  }

  /** Returns an array of internal (string) dashboard UIDs */
  async getDashboardOpened(): Promise<string[]> {
    if (contextSrv.isSignedIn) {
      try {
        const dashboardUids = await fetchDashboardViews();
        store.set(this.impressionKey(), JSON.stringify(dashboardUids));
        return dashboardUids;
      } catch (_) {
        // Fall back to local impressions when the backend is unavailable.
      }
    }

    // TODO should be removed after UID migration
    try {
      await this.convertToUIDs();
    } catch (_) {}

    const result = filter(this.getImpressions(), (el) => isString(el));
    return result;
  }

  clearImpressions() {
    store.set(this.impressionKey(), JSON.stringify([]));

    if (contextSrv.isSignedIn) {
      clearDashboardViews().catch(() => {
        // Local impressions are already cleared.
      });
    }
  }

  impressionKey() {
    return 'dashboard_impressions-' + contextSrv.user.orgId;
  }
}

const impressionSrv = new ImpressionSrv();
export default impressionSrv;
