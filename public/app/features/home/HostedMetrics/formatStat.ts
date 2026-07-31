import { getValueFormat } from '@grafana/data';

/** Compact human-readable number for quick-glance stats (e.g. 4.2M, 12.5k). */
export function formatStat(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  const formatted = getValueFormat('short')(value, 1, undefined, undefined);
  return `${formatted.text}${formatted.suffix ?? ''}`.trim();
}
