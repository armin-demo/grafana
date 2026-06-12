import { createTheme, NewThemeOptionsSchema } from './createTheme';
import evergreen from './themeDefinitions/evergreen.json';

describe('createTheme', () => {
  it('create custom theme', () => {
    const custom = createTheme({
      colors: {
        mode: 'dark',
        primary: {
          main: 'rgb(240,0,0)',
        },
        background: {
          canvas: '#123',
        },
      },
    });

    expect(custom.colors.primary.main).toBe('rgb(240,0,0)');
    expect(custom.colors.primary.shade).toBe('rgb(242, 38, 38)');
    expect(custom.colors.background.canvas).toBe('#123');
  });

  it('create default theme', () => {
    const theme = createTheme();
    expect(theme.colors.mode).toBe('dark');
  });

  it('creates the evergreen theme', () => {
    const result = NewThemeOptionsSchema.safeParse(evergreen);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw result.error;
    }

    const theme = createTheme(result.data);
    expect(theme.name).toBe('Evergreen');
    expect(theme.colors.primary.main).toBe('#45D483');
    expect(theme.colors.background.canvas).toBe('#07120D');
    expect(theme.visualization.palette[0]).toBe('#45D483');
  });
});
