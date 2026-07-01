import { config } from '@grafana/runtime';

import { getSelectableThemes } from './getSelectableThemes';

describe('getSelectableThemes', () => {
  const originalFeatureToggles = config.featureToggles;

  beforeEach(() => {
    config.featureToggles = {
      ...originalFeatureToggles,
      colorblindThemes: false,
      grafanaconThemes: false,
    };
  });

  afterAll(() => {
    config.featureToggles = originalFeatureToggles;
  });

  it('includes evergreen by default', () => {
    expect(getSelectableThemes().map((theme) => theme.id)).toEqual(['dark', 'light', 'system', 'evergreen']);
  });

  it('includes evergreen alongside feature-flagged extras', () => {
    config.featureToggles = {
      ...config.featureToggles,
      colorblindThemes: true,
      grafanaconThemes: true,
    };

    expect(getSelectableThemes().map((theme) => theme.id)).toEqual([
      'dark',
      'light',
      'system',
      'desertbloom',
      'deut_prot_dark',
      'deut_prot_light',
      'evergreen',
      'gildedgrove',
      'gloom',
      'sapphiredusk',
      'tritanopia_dark',
      'tritanopia_light',
      'tron',
    ]);
  });
});
