import { filter, isArray, isNumber, isString } from 'lodash';

import { store } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { contextSrv } from './context_srv';

const MAX_DASHBOARD_IMPRESSIONS = 50;

interface DashboardHistoryPreference {
  recentDashboardUIDs?: string[];
}

interface UserPreferencesResponse {
  dashboardHistory?: DashboardHistoryPreference;
}

export class ImpressionSrv {
  private serverImpressionsLoaded = false;
  private serverImpressions: string[] | null = null;

  addDashboardImpression(dashboardUID: string) {
    const impressions = this.updateLocalImpressions(dashboardUID);
    this.syncToServer(impressions);
  }

  private updateLocalImpressions(dashboardUID: string): string[] {
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

    if (impressions.length > MAX_DASHBOARD_IMPRESSIONS) {
      impressions.pop();
    }
    store.set(impressionsKey, JSON.stringify(impressions));
    this.serverImpressions = impressions;

    return impressions;
  }

  private async convertToUIDs() {
    let impressions = this.getLocalImpressions();
    const ids = filter(impressions, (el) => isNumber(el));
    if (!ids.length) {
      return;
    }

    const convertedUIDs = await getBackendSrv().get<string[]>(`/api/dashboards/ids/${ids.join(',')}`);
    store.set(this.impressionKey(), JSON.stringify([...filter(impressions, (el) => isString(el)), ...convertedUIDs]));
  }

  private getLocalImpressions(): string[] {
    const impressions = store.get(this.impressionKey()) || '[]';

    return JSON.parse(impressions);
  }

  /** Returns an array of internal (string) dashboard UIDs */
  async getDashboardOpened(): Promise<string[]> {
    // TODO should be removed after UID migration
    try {
      await this.convertToUIDs();
    } catch (_) {}

    if (this.canSyncToServer()) {
      await this.loadFromServerIfNeeded();
      if (this.serverImpressions !== null) {
        return filter(this.serverImpressions, (el) => isString(el));
      }
    }

    return filter(this.getLocalImpressions(), (el) => isString(el));
  }

  clearImpressions() {
    store.set(this.impressionKey(), JSON.stringify([]));
    this.serverImpressions = [];
    this.syncToServer([]);
  }

  impressionKey() {
    return 'dashboard_impressions-' + contextSrv.user.orgId;
  }

  private canSyncToServer() {
    return contextSrv.isSignedIn;
  }

  private async loadFromServerIfNeeded() {
    if (this.serverImpressionsLoaded) {
      return;
    }

    try {
      const preferences = await getBackendSrv().get<UserPreferencesResponse>('/api/user/preferences');
      const serverUIDs = preferences.dashboardHistory?.recentDashboardUIDs ?? [];
      const localUIDs = filter(this.getLocalImpressions(), (el) => isString(el));

      if (serverUIDs.length === 0 && localUIDs.length > 0) {
        this.serverImpressions = localUIDs;
        await this.syncToServer(localUIDs);
      } else {
        this.serverImpressions = serverUIDs;
        store.set(this.impressionKey(), JSON.stringify(serverUIDs));
      }
    } catch (error) {
      console.error('Failed to load recently viewed dashboards from server', error);
      this.serverImpressions = null;
    }

    this.serverImpressionsLoaded = true;
  }

  private async syncToServer(uids: string[]) {
    if (!this.canSyncToServer()) {
      return;
    }

    try {
      await getBackendSrv().patch('/api/user/preferences', {
        dashboardHistory: {
          recentDashboardUIDs: uids,
        },
      });
      this.serverImpressions = uids;
      this.serverImpressionsLoaded = true;
    } catch (error) {
      console.error('Failed to sync recently viewed dashboards to server', error);
    }
  }
}

const impressionSrv = new ImpressionSrv();
export default impressionSrv;
