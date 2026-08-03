import { getThemeById } from '@grafana/data';

import { getSelectableThemes } from './getSelectableThemes';

describe('green theme', () => {
  it('is selectable', () => {
    const ids = getSelectableThemes().map((t) => t.id);
    expect(ids).toContain('green');
  });

  it('builds with expected name and mode', () => {
    const theme = getThemeById('green');
    expect(theme.name).toBe('Green');
    expect(theme.colors.mode).toBe('dark');
    expect(theme.colors.primary.main).toBe('#2E7D4F');
  });
});
