import { getSelectableThemes } from './getSelectableThemes';

describe('getSelectableThemes', () => {
  it('includes the green experimental theme', () => {
    const themes = getSelectableThemes();
    expect(themes.map((theme) => theme.id)).toEqual(expect.arrayContaining(['green']));
    expect(themes.find((theme) => theme.id === 'green')?.name).toBe('Green');
  });
});
