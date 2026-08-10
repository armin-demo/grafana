import { memo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { getRecentlyViewedDashboards } from 'app/features/browse-dashboards/api/recentlyViewed';

export const LastViewedDashboardButton = memo(function LastViewedDashboardButton() {
  const location = useLocation();

  // Re-read on every navigation so the shortcut always points at the most recently opened dashboard.
  // location.pathname isn't referenced inside the callback; it's the retrigger, hence the disable.
  const { value: dashboards = [] } = useAsync(async () => {
    if (!contextSrv.user.isSignedIn) {
      return [];
    }
    return getRecentlyViewedDashboards(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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
