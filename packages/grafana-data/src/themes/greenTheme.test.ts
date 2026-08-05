import { NewThemeOptionsSchema } from './createTheme';
import { getBuiltInThemes, getThemeById } from './registry';
import green from './themeDefinitions/green.json';

describe('green theme', () => {
  it('validates against NewThemeOptionsSchema', () => {
    const result = NewThemeOptionsSchema.safeParse(green);
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.log(result.error.message);
    }
    expect(result.success).toBe(true);
  });

  it('is registered and selectable', () => {
    expect(getThemeById('green').name).toBe('Green');
    expect(getBuiltInThemes(['green']).map((theme) => theme.id)).toContain('green');
  });
});
