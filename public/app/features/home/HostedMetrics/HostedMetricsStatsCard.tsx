import { css } from '@emotion/css';
import { useAsyncRetry } from 'react-use';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { hostedMetricsCardClicked } from '../analytics/main';
import { HomeSection } from '../HomeSection';

import { HOME_HOSTED_METRICS_ID, METRICS_DRILLDOWN_PATH } from './constants';
import { fetchHostedMetricsStats } from './fetchHostedMetricsStats';
import { formatStat } from './formatStat';

/**
 * Quick-glance Hosted Metrics stats on the homepage (active series + DPM).
 * Loads from a Prometheus-compatible metrics datasource when available.
 */
export function HostedMetricsStatsCard() {
  const styles = useStyles2(getStyles);
  const { value, loading, error, retry } = useAsyncRetry(fetchHostedMetricsStats, []);

  const hasStats = value != null && (value.activeSeries != null || value.dpm != null);
  const noDatasource = value != null && value.datasourceUid == null;

  return (
    <HomeSection id={HOME_HOSTED_METRICS_ID} display="flex" direction="column" data-testid="home-hosted-metrics">
      <Stack direction="column" gap={2} grow={1}>
        <Stack alignItems="center" justifyContent="space-between">
          <Text element="h2" variant="h5">
            <Trans i18nKey="home.hosted-metrics-stats.title">Hosted Metrics</Trans>
          </Text>
          {!loading && value?.datasourceName && (
            <Text color="secondary" variant="bodySmall">
              {value.datasourceName}
            </Text>
          )}
        </Stack>

        {loading && (
          <Stack direction="row" gap={3}>
            <Skeleton width={120} height={48} />
            <Skeleton width={120} height={48} />
          </Stack>
        )}

        {!loading && error && (
          <Alert
            severity="warning"
            title={t('home.hosted-metrics-stats.error-title', 'Could not load Hosted Metrics stats')}
            action={
              <Button onClick={() => retry()} variant="secondary" size="sm">
                <Trans i18nKey="home.hosted-metrics-stats.retry">Retry</Trans>
              </Button>
            }
          />
        )}

        {!loading && !error && noDatasource && (
          <Stack direction="column" alignItems="flex-start" gap={1}>
            <Text color="secondary">
              <Trans i18nKey="home.hosted-metrics-stats.no-datasource">
                Connect a metrics data source to see active series and data points per minute.
              </Trans>
            </Text>
            <LinkButton
              href="/connections/datasources"
              size="sm"
              variant="secondary"
              onClick={() => hostedMetricsCardClicked({ action: 'add_datasource', placement: 'empty_state' })}
            >
              <Trans i18nKey="home.hosted-metrics-stats.add-datasource">Add data source</Trans>
            </LinkButton>
          </Stack>
        )}

        {!loading && !error && value != null && !noDatasource && !hasStats && (
          <Stack direction="column" alignItems="flex-start" gap={1}>
            <Text color="secondary">
              <Trans i18nKey="home.hosted-metrics-stats.empty">
                No active series or DPM metrics were found on this data source yet.
              </Trans>
            </Text>
            <LinkButton
              href={METRICS_DRILLDOWN_PATH}
              size="sm"
              variant="secondary"
              onClick={() => hostedMetricsCardClicked({ action: 'open_metrics', placement: 'empty_state' })}
            >
              <Trans i18nKey="home.hosted-metrics-stats.explore-metrics">Explore Metrics</Trans>
            </LinkButton>
          </Stack>
        )}

        {!loading && !error && hasStats && value && (
          <>
            <div className={styles.statsRow}>
              <StatBlock
                label={t('home.hosted-metrics-stats.active-series', 'Active series')}
                value={formatStat(value.activeSeries)}
              />
              <StatBlock
                label={t('home.hosted-metrics-stats.dpm', 'Data points / min')}
                value={formatStat(value.dpm)}
              />
            </div>
            <Stack justifyContent="flex-end">
              <TextLink
                href={METRICS_DRILLDOWN_PATH}
                inline={false}
                onClick={() => hostedMetricsCardClicked({ action: 'open_metrics', placement: 'footer' })}
              >
                <Trans i18nKey="home.hosted-metrics-stats.view-metrics">View Metrics</Trans>
              </TextLink>
            </Stack>
          </>
        )}
      </Stack>
    </HomeSection>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.stat}>
      <Text variant="h3" weight="medium" className={styles.statValue}>
        {value}
      </Text>
      <Text color="secondary" variant="bodySmall">
        {label}
      </Text>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  statsRow: css({
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(2),
  }),
  stat: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    minWidth: 0,
  }),
  statValue: css({
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
  }),
});
