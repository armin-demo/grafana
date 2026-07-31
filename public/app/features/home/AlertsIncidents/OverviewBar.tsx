import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { escapeRegExp } from 'lodash';
import { useMemo } from 'react';
import { useAsync } from 'react-use';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { Badge, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { ACTIVE_INCIDENTS_QUERY_LIMIT, incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { canonicalSeverity } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/constants';
import { type Team } from 'app/types/teams';

import { overviewBarClicked } from '../analytics/main';
import { HomeSection } from '../HomeSection';

import { canViewFiringAlerts } from './FiringAlertsCard';
import { HOME_ACTIVE_INCIDENTS_ID, HOME_FIRING_ALERTS_ID } from './constants';
import { computeStartTimeTrend } from './overviewTrend';

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildTeamMatchers(teamNames: string[]) {
  if (teamNames.length === 0) {
    return [];
  }
  return [{ name: 'team', value: teamNames.map(escapeRegExp).join('|'), isRegex: true, isEqual: true }];
}

/**
 * Compact at-a-glance bar for firing alerts + active incidents.
 * Segments scroll to the corresponding homepage cards.
 */
export function OverviewBar() {
  const showAlerts = canViewFiringAlerts();
  const { pluginId, installed, loading: pluginLoading } = useIrmPlugin(SupportedPlugin.Incident);
  const showIncidents = !pluginLoading && !!installed;

  if (!showAlerts && !showIncidents) {
    return null;
  }

  return (
    <OverviewBarInner showAlerts={showAlerts} showIncidents={showIncidents} pluginId={pluginId} />
  );
}

type OverviewBarInnerProps = {
  showAlerts: boolean;
  showIncidents: boolean;
  pluginId: string;
};

function OverviewBarInner({ showAlerts, showIncidents, pluginId }: OverviewBarInnerProps) {
  const styles = useStyles2(getStyles);

  const { value: teams, loading: teamsLoading } = useAsync(
    () => (showAlerts ? getBackendSrv().get<Team[]>('/api/user/teams') : Promise.resolve([])),
    [showAlerts]
  );

  const teamNames = (teams ?? []).map((team) => team.name);
  const matchers = teamNames.length > 0 ? buildTeamMatchers(teamNames) : [];

  const {
    data: alerts,
    isLoading: alertsLoading,
  } = alertmanagerApi.useGetAlertmanagerAlertsQuery(
    !showAlerts || teamsLoading
      ? skipToken
      : {
          amSourceName: GRAFANA_RULES_SOURCE_NAME,
          filter: { active: true, silenced: false, inhibited: false, matchers },
          showErrorAlert: false,
        }
  );

  const {
    data: incidents = [],
    isLoading: incidentsLoading,
  } = incidentsApi.useGetActiveIncidentsQuery(showIncidents ? { pluginId } : skipToken, {
    refetchOnMountOrArgChange: true,
  });

  const alertsSummary = useMemo(() => {
    let criticalCount = 0;
    let highCount = 0;
    const startTimes: string[] = [];
    for (const alert of alerts ?? []) {
      const level = canonicalSeverity(alert.labels.severity ?? '');
      if (level === 'critical') {
        criticalCount++;
      } else if (level === 'major') {
        highCount++;
      }
      startTimes.push(alert.startsAt);
    }
    return {
      total: alerts?.length ?? 0,
      criticalCount,
      highCount,
      trend: computeStartTimeTrend(startTimes),
    };
  }, [alerts]);

  const incidentCount = incidents?.length ?? 0;
  const incidentCountText =
    incidentCount >= ACTIVE_INCIDENTS_QUERY_LIMIT ? `${ACTIVE_INCIDENTS_QUERY_LIMIT}+` : String(incidentCount);

  const alertsBusy = showAlerts && (teamsLoading || alertsLoading);
  const incidentsBusy = showIncidents && incidentsLoading;

  return (
    <HomeSection data-testid="home-overview-bar">
      <Stack direction="row" gap={2} wrap="wrap" alignItems="stretch">
        {showAlerts && (
          <button
            type="button"
            className={styles.segment}
            data-testid="home-overview-bar-alerts"
            aria-label={t('home.overview-bar.alerts-aria', 'Scroll to firing alerts')}
            onClick={() => {
              overviewBarClicked({ segment: 'alerts' });
              scrollToSection(HOME_FIRING_ALERTS_ID);
            }}
          >
            <Stack direction="column" gap={0.5}>
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="home.overview-bar.alerts-label">Firing alerts</Trans>
              </Text>
              {alertsBusy ? (
                <Skeleton width={120} height={28} />
              ) : (
                <Stack alignItems="center" gap={1} wrap="wrap">
                  <Text element="span" variant="h4">
                    {alertsSummary.total}
                  </Text>
                  {alertsSummary.criticalCount > 0 && (
                    <Badge
                      text={t('home.overview-bar.critical-count', '', {
                        count: alertsSummary.criticalCount,
                        defaultValue_one: '{{count}} critical',
                        defaultValue_other: '{{count}} critical',
                      })}
                      color="red"
                    />
                  )}
                  {alertsSummary.highCount > 0 && (
                    <Badge
                      text={t('home.overview-bar.high-count', '', {
                        count: alertsSummary.highCount,
                        defaultValue_one: '{{count}} high',
                        defaultValue_other: '{{count}} high',
                      })}
                      color="orange"
                    />
                  )}
                  <TrendBadge delta={alertsSummary.trend.delta} />
                </Stack>
              )}
            </Stack>
            <Icon name="angle-down" className={styles.chevron} />
          </button>
        )}

        {showIncidents && (
          <button
            type="button"
            className={styles.segment}
            data-testid="home-overview-bar-incidents"
            aria-label={t('home.overview-bar.incidents-aria', 'Scroll to active incidents')}
            onClick={() => {
              overviewBarClicked({ segment: 'incidents' });
              scrollToSection(HOME_ACTIVE_INCIDENTS_ID);
            }}
          >
            <Stack direction="column" gap={0.5}>
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="home.overview-bar.incidents-label">Active incidents</Trans>
              </Text>
              {incidentsBusy ? (
                <Skeleton width={80} height={28} />
              ) : (
                <Text element="span" variant="h4">
                  {incidentCountText}
                </Text>
              )}
            </Stack>
            <Icon name="angle-down" className={styles.chevron} />
          </button>
        )}
      </Stack>
    </HomeSection>
  );
}

function TrendBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <Badge
        icon="arrow-up"
        color="red"
        text={t('home.overview-bar.trend-up', '', {
          count: delta,
          defaultValue: '+{{count}} (24h)',
        })}
      />
    );
  }
  if (delta < 0) {
    return (
      <Badge
        icon="arrow-down"
        color="green"
        text={t('home.overview-bar.trend-down', '', {
          count: Math.abs(delta),
          defaultValue: '-{{count}} (24h)',
        })}
      />
    );
  }
  return (
    <Badge
      icon="minus"
      color="blue"
      text={t('home.overview-bar.trend-flat', '0 (24h)')}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  segment: css({
    appearance: 'none',
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1.5, 2),
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    flex: '1 1 220px',
    minWidth: 0,
    textAlign: 'left',
    color: 'inherit',
    transition: theme.transitions.create(['border-color', 'background-color'], {
      duration: theme.transitions.duration.short,
    }),
    '&:hover': {
      borderColor: theme.colors.border.medium,
      background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: 2,
    },
  }),
  chevron: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
});
