import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';
import { useAsyncFn } from 'react-use';
import { shallowEqual } from 'react-redux';

import { type DataQuery, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import {
  Alert,
  EmptyState,
  FilterInput,
  PanelContainer,
  Spinner,
  Text,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { changeQueries, runQueries } from '../state/query';
import { getExploreItemSelector } from '../state/selectors';

import { getMetricsLanguageProvider } from './isPrometheusCompatibleDatasource';

const ROW_HEIGHT = 28;
const SIDEBAR_WIDTH = 280;

export type QueryWithExpr = DataQuery & { expr?: string };

export const METRICS_SIDEBAR_LOCAL_STORAGE_KEYS = {
  visible: 'grafana.explore.metricsSidebar.visible',
};

interface Props {
  exploreId: string;
}

/** First query with an empty expr, otherwise the last query. */
export function findTargetQueryIndex(queries: QueryWithExpr[]): number {
  if (queries.length === 0) {
    return -1;
  }
  const emptyIndex = queries.findIndex((q) => !q.expr);
  return emptyIndex >= 0 ? emptyIndex : queries.length - 1;
}

function formatMetricTooltip(type?: string, help?: string): string | undefined {
  const parts: string[] = [];
  if (type) {
    parts.push(type);
  }
  if (help) {
    parts.push(help);
  }
  return parts.length > 0 ? parts.join('\n') : undefined;
}

export function MetricsSidebar({ exploreId }: Props) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const exploreItemSelector = useMemo(() => getExploreItemSelector(exploreId), [exploreId]);
  const { datasourceInstance, range, queries } = useSelector((state) => {
    const pane = exploreItemSelector(state);
    return {
      datasourceInstance: pane?.datasourceInstance,
      range: pane?.range,
      queries: (pane?.queries ?? []) as QueryWithExpr[],
    };
  }, shallowEqual);

  const [search, setSearch] = useState('');
  const languageProvider = getMetricsLanguageProvider(datasourceInstance);

  const [metricsState, fetchMetrics] = useAsyncFn(async () => {
    if (!languageProvider || !range) {
      return { metrics: [] as string[], metadata: {} as Record<string, { type?: string; help?: string }> };
    }
    await languageProvider.start(range);
    return {
      metrics: languageProvider.retrieveMetrics() ?? [],
      metadata: languageProvider.retrieveMetricsMetadata() ?? {},
    };
  }, [languageProvider, range]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const metrics = metricsState.value?.metrics ?? [];
  const metadata = metricsState.value?.metadata ?? {};

  const filteredMetrics = useMemo(() => {
    if (!search) {
      return metrics;
    }
    const lower = search.toLowerCase();
    return metrics.filter((metric) => metric.toLowerCase().includes(lower));
  }, [metrics, search]);

  const onMetricClick = useCallback(
    (metricName: string) => {
      const targetIndex = findTargetQueryIndex(queries);
      if (targetIndex < 0) {
        return;
      }

      const updated = queries.map((query, index) =>
        index === targetIndex ? { ...query, expr: metricName } : query
      );

      dispatch(changeQueries({ exploreId, queries: updated }));
      dispatch(runQueries({ exploreId }));
      reportInteraction('explore_metrics_sidebar_metric_clicked', {
        metric: metricName,
        targetRefId: queries[targetIndex]?.refId,
      });
    },
    [dispatch, exploreId, queries]
  );

  const renderList = () => {
    if (metricsState.loading) {
      return (
        <div className={styles.centered}>
          <Spinner />
          <Text color="secondary">{t('explore.metrics-sidebar.loading', 'Loading metrics...')}</Text>
        </div>
      );
    }

    if (metricsState.error) {
      return (
        <Alert
          severity="error"
          title={t('explore.metrics-sidebar.error-title', 'Failed to load metrics')}
        >
          {metricsState.error instanceof Error
            ? metricsState.error.message
            : t('explore.metrics-sidebar.error-unknown', 'An unknown error occurred')}
        </Alert>
      );
    }

    if (filteredMetrics.length === 0) {
      return (
        <div className={styles.centered}>
          <EmptyState
            variant="not-found"
            message={
              search
                ? t('explore.metrics-sidebar.no-matches', 'No metrics match your search')
                : t('explore.metrics-sidebar.empty', 'No metrics found')
            }
          />
        </div>
      );
    }

    return (
      <div className={styles.listContainer} data-testid={selectors.components.MetricsSidebar.metricList}>
        <AutoSizer>
          {({ height, width }) => (
            <FixedSizeList
              height={height}
              width={width}
              itemCount={filteredMetrics.length}
              itemSize={ROW_HEIGHT}
              itemKey={(index) => filteredMetrics[index]}
            >
              {({ index, style }) => {
                const metricName = filteredMetrics[index];
                const meta = metadata[metricName];
                const tooltip = formatMetricTooltip(meta?.type, meta?.help);

                const button = (
                  <button
                    type="button"
                    className={styles.metricButton}
                    onClick={() => onMetricClick(metricName)}
                    data-testid={selectors.components.MetricsSidebar.metricItem(metricName)}
                    title={tooltip}
                  >
                    <span className={styles.metricName}>{metricName}</span>
                  </button>
                );

                return (
                  <div style={style}>
                    {tooltip ? (
                      <Tooltip content={tooltip} placement="right">
                        {button}
                      </Tooltip>
                    ) : (
                      button
                    )}
                  </div>
                );
              }}
            </FixedSizeList>
          )}
        </AutoSizer>
      </div>
    );
  };

  return (
    <PanelContainer className={styles.wrapper} id={`metrics-sidebar-container-${exploreId}`}>
      <div className={styles.header}>
        <Text element="h6" variant="bodySmall" weight="medium">
          {t('explore.metrics-sidebar.title', 'Metrics')}
        </Text>
        <FilterInput
          value={search}
          onChange={setSearch}
          placeholder={t('explore.metrics-sidebar.search-placeholder', 'Search metrics')}
          escapeRegex={false}
          data-testid={selectors.components.MetricsSidebar.searchInput}
          aria-label={t('explore.metrics-sidebar.search-aria-label', 'Search metrics')}
        />
      </div>
      {renderList()}
    </PanelContainer>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'metrics-sidebar',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      marginRight: theme.spacing(1),
      height: '100%',
      backgroundColor: theme.colors.background.primary,
      width: SIDEBAR_WIDTH,
      minWidth: SIDEBAR_WIDTH,
      overflow: 'hidden',
    }),
    header: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      flexShrink: 0,
    }),
    listContainer: css({
      flex: 1,
      minHeight: 0,
      position: 'relative',
    }),
    centered: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(2),
      flex: 1,
    }),
    metricButton: css({
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      padding: theme.spacing(0, 1),
      border: 'none',
      background: 'transparent',
      color: theme.colors.text.primary,
      cursor: 'pointer',
      textAlign: 'left',
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    metricName: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
};
