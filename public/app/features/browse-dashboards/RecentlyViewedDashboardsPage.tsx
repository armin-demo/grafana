import { css } from '@emotion/css';
import { memo } from 'react';
import { useAsyncRetry } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button, Grid, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import impressionSrv from 'app/core/services/impression_srv';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';

import { getRecentlyViewedDashboards } from './api/recentlyViewed';

const MAX_RECENT = 20;

const RecentlyViewedDashboardsPage = memo(() => {
  const styles = useStyles2(getStyles);

  const {
    value: recentDashboards = [],
    loading,
    error,
    retry,
  } = useAsyncRetry(() => getRecentlyViewedDashboards(MAX_RECENT), []);

  const { foldersByUid } = useDashboardLocationInfo(recentDashboards.length > 0);

  const handleClearHistory = () => {
    reportInteraction('grafana_recently_viewed_dashboards_clear_history', { source: 'recently_viewed_page' });
    impressionSrv.clearImpressions();
    retry();
  };

  return (
    <Page
      navId="dashboards"
      pageNav={{
        text: t('browse-dashboards.recently-viewed.page-title', 'Recently viewed dashboards'),
        subTitle: t(
          'browse-dashboards.recently-viewed.page-subtitle',
          'Dashboards you have opened recently, synced across your devices.'
        ),
      }}
    >
      <Page.Contents className={styles.pageContents}>
        {loading && (
          <Stack alignItems="center" justifyContent="center" height={10}>
            <Spinner />
          </Stack>
        )}

        {error && (
          <Alert
            severity="warning"
            title={t('browse-dashboards.recently-viewed.error', 'Recently viewed dashboards couldn’t be loaded.')}
            buttonContent={t('browse-dashboards.recently-viewed.retry', 'Retry')}
            onRemove={retry}
          />
        )}

        {!loading && !error && recentDashboards.length === 0 && (
          <Stack direction="column" gap={2} alignItems="flex-start">
            <Text color="secondary">
              <Trans i18nKey="browse-dashboards.recently-viewed.empty">
                Dashboards you open will appear here so you can quickly return to them.
              </Trans>
            </Text>
            <Button icon="apps" href="/dashboards">
              <Trans i18nKey="browse-dashboards.recently-viewed.browse">Browse dashboards</Trans>
            </Button>
          </Stack>
        )}

        {!loading && recentDashboards.length > 0 && (
          <Stack direction="column" gap={2}>
            <Stack justifyContent="space-between" alignItems="center">
              <Text variant="h5" element="h2">
                <Trans i18nKey="browse-dashboards.recently-viewed.title">Recently viewed</Trans>
              </Text>
              <Button icon="times" size="sm" variant="secondary" fill="text" onClick={handleClearHistory}>
                <Trans i18nKey="browse-dashboards.recently-viewed.clear">Clear history</Trans>
              </Button>
            </Stack>
            <ul className={styles.list}>
              <Grid columns={{ xs: 1, sm: 2, md: 3, lg: 4 }} gap={2}>
                {recentDashboards.map((dash, idx) => (
                  <li key={dash.uid} className={styles.listItem}>
                    <DashListItem
                      order={idx + 1}
                      dashboard={dash}
                      url={dash.url}
                      showFolderNames={true}
                      locationInfo={foldersByUid[dash.location]}
                      layoutMode="card"
                      source="recentlyViewedPage_Card"
                    />
                  </li>
                ))}
              </Grid>
            </ul>
          </Stack>
        )}
      </Page.Contents>
    </Page>
  );
});

RecentlyViewedDashboardsPage.displayName = 'RecentlyViewedDashboardsPage';

export default RecentlyViewedDashboardsPage;

const getStyles = (theme: GrafanaTheme2) => ({
  pageContents: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  listItem: css({
    margin: 0,
  }),
});
