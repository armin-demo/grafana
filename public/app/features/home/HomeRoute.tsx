import { lazy, Suspense, useEffect } from 'react';

import { useMergedPreferencesQuery } from '@grafana/api-clients/rtkq/preferences/v1alpha1';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SETUP_GUIDE_HOME_URL } from 'app/core/hooks/useHomeNav';
import { GrafanaRouteLoading } from 'app/core/navigation/GrafanaRouteLoading';

import { type DashboardPageProxyProps } from '../dashboard/containers/DashboardPageProxy';

const DashboardPageProxy = lazy(
  () => import(/* webpackChunkName: "DashboardPageProxy" */ '../dashboard/containers/DashboardPageProxy')
);
const HomePage = lazy(() => import(/* webpackChunkName: "HomePage" */ './HomePage'));

function UnifiedHomeRoute(props: DashboardPageProxyProps) {
  const { data, isLoading, isError } = useMergedPreferencesQuery();
  const redirectUri = data?.spec?.homeURL;
  const homeDashboardUID = data?.spec?.homeDashboardUID;
  // homeDashboardUID takes precedence over homeURL; the setup guide redirect is superseded by the new homepage
  const willRedirect = !!redirectUri && !homeDashboardUID && redirectUri !== SETUP_GUIDE_HOME_URL;

  useEffect(() => {
    if (!willRedirect) {
      return;
    }
    const newUrl = locationUtil.processRedirectUri(redirectUri, locationService.getLocation());
    locationService.replace(newUrl);
  }, [willRedirect, redirectUri]);

  if (isLoading || willRedirect) {
    return <GrafanaRouteLoading />;
  }

  // Probe failed: prefer the unified homepage over the removed legacy home dashboard.
  if (isError || !data) {
    return <HomePage />;
  }

  if (homeDashboardUID) {
    return <DashboardPageProxy {...props} />;
  }

  return <HomePage />;
}

export default function HomeRoute(props: DashboardPageProxyProps) {
  return (
    <Suspense fallback={<GrafanaRouteLoading />}>
      <UnifiedHomeRoute {...props} />
    </Suspense>
  );
}
