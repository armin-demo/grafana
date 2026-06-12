import { css } from '@emotion/css';
import { type ReactNode } from 'react';
import { useAsyncRetry } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Card, Icon, Link, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { StarToolbarButton } from 'app/features/stars/StarToolbarButton';

import { getLatestViewedDashboard } from '../api/recentlyViewed';

export function LatestViewedDashboard() {
  const styles = useStyles2(getStyles);

  const { value: dashboard, loading, error, retry } = useAsyncRetry(() => getLatestViewedDashboard(), []);
  const { foldersByUid } = useDashboardLocationInfo(Boolean(dashboard));

  if (loading) {
    return (
      <Card className={styles.card}>
        <Stack alignItems="center" justifyContent="center" height={8}>
          <Spinner />
        </Stack>
      </Card>
    );
  }

  if (error || !dashboard) {
    return null;
  }

  const locationInfo = foldersByUid[dashboard.location];

  const onOpenClick = () => {
    reportInteraction('grafana_latest_viewed_dashboard_open', {
      uid: dashboard.uid,
      source: 'home_latest_viewed_card',
    });
  };

  return (
    <Card className={styles.card}>
      <Stack direction="column" gap={1}>
        <Text variant="overline" color="secondary">
          <Trans i18nKey="home.latest-viewed.label">Latest viewed</Trans>
        </Text>
        <Stack alignItems="start" justifyContent="space-between" gap={2}>
          <Stack direction="column" gap={0.5} className={styles.content}>
            <Link href={dashboard.url} className={styles.titleLink} onClick={onOpenClick}>
              <Text variant="h4" element="h2">
                {dashboard.name}
              </Text>
            </Link>
            {locationInfo && (
              <Stack alignItems="center" gap={0.5}>
                <Icon name="folder" size="sm" className={styles.folderIcon} />
                <Text color="secondary" variant="bodySmall">
                  {locationInfo.name}
                </Text>
              </Stack>
            )}
          </Stack>
          <StarToolbarButton
            title={dashboard.name}
            group="dashboard.grafana.app"
            kind="Dashboard"
            id={dashboard.uid}
          />
        </Stack>
        <Stack gap={1}>
          <LinkButton href={dashboard.url} onClick={onOpenClick}>
            <Trans i18nKey="home.latest-viewed.open">Open dashboard</Trans>
          </LinkButton>
          <Button
            variant="secondary"
            fill="outline"
            href="/dashboards/recently-viewed"
            onClick={() => reportInteraction('grafana_latest_viewed_dashboard_view_all')}
          >
            <Trans i18nKey="home.latest-viewed.view-all">View all recent</Trans>
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}

function LinkButton({ href, onClick, children }: { href: string; onClick?: () => void; children: ReactNode }) {
  return (
    <Button icon="apps" href={href} onClick={onClick}>
      {children}
    </Button>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    marginBottom: theme.spacing(2),
    background: `linear-gradient(135deg, ${theme.colors.background.secondary} 0%, ${theme.colors.background.primary} 100%)`,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  content: css({
    minWidth: 0,
    flex: 1,
  }),
  titleLink: css({
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
  folderIcon: css({
    color: theme.colors.secondary.text,
  }),
});
