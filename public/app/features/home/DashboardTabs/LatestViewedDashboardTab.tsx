import { t, Trans } from '@grafana/i18n';
import { Alert, Button, EmptyState, LinkButton } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { type DashboardQueryResult, type LocationInfo } from 'app/features/search/service/types';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';

interface Props {
  dashboard: DashboardQueryResult | undefined;
  loading: boolean;
  error: Error | undefined;
  retry: () => void;
  foldersByUid: Record<string, LocationInfo>;
}

export function LatestViewedDashboardTab({ dashboard, loading, error, retry, foldersByUid }: Props) {
  if (loading) {
    return <PageLoader text={t('home.latest-viewed-dashboard-tab.loading', 'Loading latest viewed dashboard...')} />;
  }

  if (error) {
    return (
      <Alert
        severity="warning"
        title={t('home.latest-viewed-dashboard-tab.error-title', 'Could not load latest viewed dashboard')}
        action={
          <Button onClick={retry} variant="secondary" size="sm">
            <Trans i18nKey="home.latest-viewed-dashboard-tab.retry">Retry</Trans>
          </Button>
        }
      />
    );
  }

  if (!dashboard) {
    return (
      <EmptyState
        hideImage
        variant="not-found"
        message={t('home.latest-viewed-dashboard-tab.empty', 'Your latest viewed dashboard will appear here.')}
        button={
          <LinkButton icon="apps" href="/dashboards" variant="secondary">
            <Trans i18nKey="home.latest-viewed-dashboard-tab.browse">Browse dashboards</Trans>
          </LinkButton>
        }
      />
    );
  }

  return (
    <DashListItem
      dashboard={dashboard}
      url={dashboard.url}
      showFolderNames={true}
      locationInfo={foldersByUid[dashboard.location]}
      layoutMode="list"
      source="homepage_latestViewedTab"
    />
  );
}
