import { OVERVIEW_TREND_WINDOW_MS } from './constants';

export type OverviewTrend = {
  /** Alerts that started in the current window (last 24h by default). */
  current: number;
  /** Alerts that started in the previous window (prior 24h). */
  previous: number;
  /** current - previous; positive means more new firing alerts than the prior window. */
  delta: number;
};

/**
 * Compare how many items started in the last window vs the prior window.
 * Used by the homepage overview bar as a lightweight trend without a separate history API.
 */
export function computeStartTimeTrend(
  startTimes: Array<string | number | Date>,
  nowMs: number = Date.now(),
  windowMs: number = OVERVIEW_TREND_WINDOW_MS
): OverviewTrend {
  const currentStart = nowMs - windowMs;
  const previousStart = nowMs - 2 * windowMs;

  let current = 0;
  let previous = 0;

  for (const raw of startTimes) {
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) {
      continue;
    }
    if (t >= currentStart) {
      current++;
    } else if (t >= previousStart) {
      previous++;
    }
  }

  return { current, previous, delta: current - previous };
}
