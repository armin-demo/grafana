const mockBackendSrv = jest.fn();

const mockContextSrv = {
  isSignedIn: true,
  user: {
    orgId: 'testOrgId',
  },
};

import impressionSrv from '../services/impression_srv';

jest.mock('@grafana/runtime', () => {
  const originalRuntime = jest.requireActual('@grafana/runtime');
  return {
    ...originalRuntime,
    getBackendSrv: mockBackendSrv,
  };
});

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: mockContextSrv,
}));

describe('ImpressionSrv', () => {
  beforeEach(() => {
    window.localStorage.removeItem(impressionSrv.impressionKey());
    mockBackendSrv.mockReset();
    mockContextSrv.isSignedIn = true;
    (impressionSrv as any).serverImpressionsLoaded = false;
    (impressionSrv as any).serverImpressions = null;
  });

  describe('getDashboardOpened', () => {
    it('should return list of dashboard uids from local storage when not signed in', async () => {
      mockContextSrv.isSignedIn = false;
      window.localStorage.setItem(impressionSrv.impressionKey(), JSON.stringify(['three', 'four']));
      const result = await impressionSrv.getDashboardOpened();
      expect(result).toEqual(['three', 'four']);
    });

    it('should return list of dashboard uids from server when signed in', async () => {
      mockBackendSrv.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({
          dashboardHistory: {
            recentDashboardUIDs: ['server-one', 'server-two'],
          },
        }),
        patch: jest.fn().mockResolvedValue({}),
      }));

      const result = await impressionSrv.getDashboardOpened();
      expect(result).toEqual(['server-one', 'server-two']);
      expect(window.localStorage.getItem(impressionSrv.impressionKey())).toEqual(
        JSON.stringify(['server-one', 'server-two'])
      );
    });

    it('should migrate local impressions to server when server is empty', async () => {
      const patchMock = jest.fn().mockResolvedValue({});
      mockBackendSrv.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({}),
        patch: patchMock,
      }));

      window.localStorage.setItem(impressionSrv.impressionKey(), JSON.stringify(['local-one', 'local-two']));
      const result = await impressionSrv.getDashboardOpened();

      expect(result).toEqual(['local-one', 'local-two']);
      expect(patchMock).toHaveBeenCalledWith('/api/user/preferences', {
        dashboardHistory: {
          recentDashboardUIDs: ['local-one', 'local-two'],
        },
      });
    });

    it('should convert legacy numeric ids to uids', async () => {
      mockContextSrv.isSignedIn = false;
      window.localStorage.setItem(impressionSrv.impressionKey(), JSON.stringify(['five', 'four', 1, 2, 3]));
      mockBackendSrv.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue(['one', 'two', 'three']),
      }));

      const result = await impressionSrv.getDashboardOpened();
      expect(result).toEqual(['five', 'four', 'one', 'two', 'three']);
    });
  });

  describe('addDashboardImpression', () => {
    it('should sync updated impressions to server when signed in', async () => {
      const patchMock = jest.fn().mockResolvedValue({});
      mockBackendSrv.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({}),
        patch: patchMock,
      }));

      impressionSrv.addDashboardImpression('dashboard-a');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(patchMock).toHaveBeenCalledWith('/api/user/preferences', {
        dashboardHistory: {
          recentDashboardUIDs: ['dashboard-a'],
        },
      });
    });
  });

  describe('clearImpressions', () => {
    it('should clear local and server impressions', async () => {
      const patchMock = jest.fn().mockResolvedValue({});
      mockBackendSrv.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({}),
        patch: patchMock,
      }));

      window.localStorage.setItem(impressionSrv.impressionKey(), JSON.stringify(['dashboard-a']));
      impressionSrv.clearImpressions();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(window.localStorage.getItem(impressionSrv.impressionKey())).toEqual('[]');
      expect(patchMock).toHaveBeenCalledWith('/api/user/preferences', {
        dashboardHistory: {
          recentDashboardUIDs: [],
        },
      });
    });
  });
});
