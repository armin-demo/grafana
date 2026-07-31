import { formatStat } from './formatStat';

describe('formatStat', () => {
  it('formats large numbers compactly', () => {
    expect(formatStat(4_200_000)).toMatch(/4\.2/);
  });

  it('returns an em dash for nullish or non-finite values', () => {
    expect(formatStat(null)).toBe('—');
    expect(formatStat(undefined)).toBe('—');
    expect(formatStat(Number.NaN)).toBe('—');
  });

  it('formats small integers without a suffix', () => {
    expect(formatStat(42)).toMatch(/^42(\.0)?$/);
  });
});
