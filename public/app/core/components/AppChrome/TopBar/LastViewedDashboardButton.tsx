import { memo, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { getRecentlyViewedDashboards } from 'app/features/browse-dashboards/api/recentlyViewed';

function getTopImpressionUid(): string | undefined {
  try {
    const impressions = JSON.parse(store.get(impressionSrv.impressionKey()) || '[]');
    if (!Array.isArray(impressions)) {
      return undefined;
    }
    return impressions.find((el: unknown): el is string => typeof el === 'string');
  } catch {
    return undefined;
  }
}

export const LastViewedDashboardButton = memo(function LastViewedDashboardButton() {
  const location = useLocation();
  const [topUid, setTopUid] = useState<string | undefined>(() =>
    contextSrv.user.isSignedIn ? getTopImpressionUid() : undefined
  );

  // Re-check impressions on navigation so the shortcut tracks the most recent dashboard,
  // but only re-query search when the top UID actually changes.
  useEffect(() => {
    if (!contextSrv.user.isSignedIn) {
      setTopUid(undefined);
      return;
    }
    const nextTopUid = getTopImpressionUid();
    setTopUid((prev) => (prev === nextTopUid ? prev : nextTopUid));
  }, [location.pathname]);

  const { value: dashboards = [] } = useAsync(async () => {
    if (!contextSrv.user.isSignedIn || !topUid) {
      return [];
    }
    return getRecentlyViewedDashboards(1);
  }, [topUid]);

  const lastViewed = dashboards[0];
  if (!lastViewed) {
    return null;
  }

  return (
    <ToolbarButton
      iconOnly
      icon="apps"
      aria-label={t('navigation.last-viewed-dashboard.aria-label', 'Last viewed dashboard')}
      tooltip={t('navigation.last-viewed-dashboard.tooltip', 'Go to last viewed dashboard: {{name}}', {
        name: lastViewed.name,
      })}
      onClick={() => {
        reportInteraction('grafana_nav_last_viewed_dashboard_clicked');
        locationService.push(lastViewed.url);
      }}
    />
  );
});
