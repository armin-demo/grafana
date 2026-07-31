import { computeStartTimeTrend } from './overviewTrend';

describe('computeStartTimeTrend', () => {
  const now = Date.parse('2026-07-31T12:00:00.000Z');
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  it('counts items in the current vs previous window and returns the delta', () => {
    const startTimes = [
      new Date(now - 2 * hour).toISOString(), // current
      new Date(now - 10 * hour).toISOString(), // current
      new Date(now - day - 3 * hour).toISOString(), // previous
      new Date(now - 3 * day).toISOString(), // older — ignored
    ];

    expect(computeStartTimeTrend(startTimes, now)).toEqual({
      current: 2,
      previous: 1,
      delta: 1,
    });
  });

  it('returns a negative delta when the prior window had more starts', () => {
    const startTimes = [
      new Date(now - hour).toISOString(),
      new Date(now - day - hour).toISOString(),
      new Date(now - day - 2 * hour).toISOString(),
    ];

    expect(computeStartTimeTrend(startTimes, now).delta).toBe(-1);
  });

  it('skips invalid timestamps', () => {
    expect(computeStartTimeTrend(['not-a-date', new Date(now - hour).toISOString()], now)).toEqual({
      current: 1,
      previous: 0,
      delta: 1,
    });
  });
});
