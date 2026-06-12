import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAsyncRetry } from 'react-use';

import { type GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginComponents } from '@grafana/runtime';
import { Box, ScrollContainer, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import {
  getLatestViewedDashboard,
  getRecentlyViewedDashboards,
} from 'app/features/browse-dashboards/api/recentlyViewed';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { LatestViewedDashboardTab } from './LatestViewedDashboardTab';
import { RecentDashboardsTab } from './RecentDashboardsTab';
import { StarredDashboardsTab } from './StarredDashboardsTab';
import { type HomepageTab } from './types';

const LATEST_TAB_ID = 'latest';
const RECENT_TAB_ID = 'recent';
const STARRED_TAB_ID = 'starred';
const MAX_RECENT = 20;
const MAX_STARRED = 30;

interface HomepageTabExtensionProps {
  registerTab: (tab: HomepageTab) => void;
}

export function DashboardTabs() {
  const styles = useStyles2(getStyles);
  const [activeTab, setActiveTab] = useState(LATEST_TAB_ID);
  const [extensionTabs, setExtensionTabs] = useState<HomepageTab[]>([]);

  const {
    value: latestDashboard,
    loading: latestLoading,
    error: latestError,
    retry: latestRetry,
  } = useAsyncRetry(() => getLatestViewedDashboard(), []);

  const {
    value: recentDashboards,
    loading: recentLoading,
    error: recentError,
    retry: recentRetry,
  } = useAsyncRetry(() => getRecentlyViewedDashboards(MAX_RECENT), []);

  const {
    value: starredDashboards,
    loading: starredLoading,
    error: starredError,
    retry: starredRetry,
  } = useAsyncRetry(async () => {
    const response = await getGrafanaSearcher().starred({ limit: MAX_STARRED });
    return response.view.toArray();
  }, []);

  const { foldersByUid } = useDashboardLocationInfo(
    Boolean(latestDashboard) || (recentDashboards?.length ?? 0) > 0 || (starredDashboards?.length ?? 0) > 0
  );

  const { components: extensionComponents } = usePluginComponents<HomepageTabExtensionProps>({
    extensionPointId: PluginExtensionPoints.HomepageTabs,
  });

  const registerTab = useCallback((tab: HomepageTab) => {
    setExtensionTabs((prev) => {
      if (prev.some((t) => t.id === tab.id)) {
        return prev;
      }
      return [...prev, tab];
    });
  }, []);

  // Auto-switch to the non-empty tab when initial data finishes loading
  const didAutoSwitch = useRef(false);
  useEffect(() => {
    if (didAutoSwitch.current || latestLoading || recentLoading || starredLoading) {
      return;
    }
    didAutoSwitch.current = true;

    const latestEmpty = !latestDashboard;
    const recentEmpty = !recentDashboards?.length;
    const starredEmpty = !starredDashboards?.length;

    if (activeTab === LATEST_TAB_ID && latestEmpty && !recentEmpty) {
      setActiveTab(RECENT_TAB_ID);
    } else if (activeTab === LATEST_TAB_ID && latestEmpty && recentEmpty && !starredEmpty) {
      setActiveTab(STARRED_TAB_ID);
    } else if (activeTab === RECENT_TAB_ID && recentEmpty && !starredEmpty) {
      setActiveTab(STARRED_TAB_ID);
    } else if (activeTab === STARRED_TAB_ID && starredEmpty && !latestEmpty) {
      setActiveTab(LATEST_TAB_ID);
    } else if (activeTab === STARRED_TAB_ID && starredEmpty && !recentEmpty) {
      setActiveTab(RECENT_TAB_ID);
    }
  }, [latestLoading, recentLoading, starredLoading, latestDashboard, recentDashboards, starredDashboards, activeTab]);

  const builtInTabs: HomepageTab[] = [
    {
      id: LATEST_TAB_ID,
      label: t('home.dashboard-tabs.latest', 'Latest'),
      activeLabel: t('home.dashboard-tabs.latest-active', 'Latest viewed dashboard'),
      counter: latestDashboard ? 1 : undefined,
    },
    {
      id: RECENT_TAB_ID,
      label: t('home.dashboard-tabs.recent', 'Recent'),
      activeLabel: t('home.dashboard-tabs.recent-active', 'Recent dashboards'),
      counter: recentDashboards?.length,
    },
    {
      id: STARRED_TAB_ID,
      label: t('home.dashboard-tabs.starred', 'Starred'),
      activeLabel: t('home.dashboard-tabs.starred-active', 'Starred dashboards'),
      counter: starredDashboards?.length,
    },
  ];

  const contentTabs = [...builtInTabs, ...extensionTabs.filter((tab) => tab.content)];
  const linkTabs = extensionTabs.filter((tab) => tab.href);

  return (
    <Box backgroundColor="primary" borderRadius="default" padding={3} direction="column" display="flex" gap={2}>
      <TabsBar>
        {contentTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Tab
              key={tab.id}
              label={isActive ? (tab.activeLabel ?? tab.label) : tab.label}
              active={isActive}
              counter={tab.counter}
              onChangeTab={() => setActiveTab(tab.id)}
            />
          );
        })}
        {linkTabs.length > 0 && <div className={styles.linkTabsSpacer} />}
        {linkTabs.map((tab) => (
          <Tab key={tab.id} label={tab.label} icon={tab.icon} href={tab.href!} />
        ))}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        <ScrollContainer showScrollIndicators maxHeight="256px" minHeight="256px">
          {activeTab === LATEST_TAB_ID && (
            <LatestViewedDashboardTab
              dashboard={latestDashboard}
              loading={latestLoading}
              error={latestError}
              retry={latestRetry}
              foldersByUid={foldersByUid}
            />
          )}
          {activeTab === RECENT_TAB_ID && (
            <RecentDashboardsTab
              dashboards={recentDashboards ?? []}
              loading={recentLoading}
              error={recentError}
              retry={recentRetry}
              foldersByUid={foldersByUid}
            />
          )}
          {activeTab === STARRED_TAB_ID && (
            <StarredDashboardsTab
              dashboards={starredDashboards ?? []}
              loading={starredLoading}
              error={starredError}
              retry={starredRetry}
              foldersByUid={foldersByUid}
            />
          )}
          {extensionTabs
            .filter((tab) => tab.content && activeTab === tab.id)
            .map((tab) => (
              <div key={tab.id}>{tab.content}</div>
            ))}
        </ScrollContainer>
      </TabContent>

      {/* Render extension components (they return null, just register tabs) */}
      {extensionComponents.map((Component, i) => (
        <Component key={i} registerTab={registerTab} />
      ))}
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabContent: css({
    padding: 0,
  }),
  linkTabsSpacer: css({
    flex: 1,
  }),
});
