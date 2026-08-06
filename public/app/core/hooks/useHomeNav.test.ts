import { getWrapper, renderHook } from 'test/test-utils';

import { configureStore } from 'app/store/configureStore';

import { SETUP_GUIDE_HOME_URL, useHomeNav } from './useHomeNav';

const renderUseHomeNav = (url: string) => {
  const store = configureStore({
    navIndex: { home: { id: 'home', text: 'Home', url } },
  });
  return renderHook(() => useHomeNav(), { wrapper: getWrapper({ store, renderWithRouter: false }) });
};

describe('useHomeNav', () => {
  it('setup guide url → rewrites the url to the homepage', () => {
    const { result } = renderUseHomeNav(SETUP_GUIDE_HOME_URL);

    expect(result.current?.url).toBe('/');
  });

  it('other url → returns the url unchanged', () => {
    const { result } = renderUseHomeNav('/d/custom-home');

    expect(result.current?.url).toBe('/d/custom-home');
  });
});
