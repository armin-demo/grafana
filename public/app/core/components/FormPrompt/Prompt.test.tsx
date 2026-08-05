import { render } from 'test/test-utils';

import { type GrafanaLocation } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { Prompt } from './Prompt';

const unblock = jest.fn();
const blockNavigation = jest.fn().mockReturnValue(unblock);
const subscribe = jest.fn().mockReturnValue(jest.fn());

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getLocation: jest.fn(),
    getHistory: jest.fn(),
    blockNavigation: jest.fn(),
    subscribe: jest.fn(),
    getLocationObservable: jest.fn(() => ({
      subscribe: () => ({ unsubscribe: jest.fn() }),
    })),
  },
}));

describe('Prompt component', () => {
  beforeEach(() => {
    (locationService.blockNavigation as jest.Mock).mockImplementation(blockNavigation);
    (locationService.subscribe as jest.Mock).mockImplementation(subscribe);
    (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/current' } as GrafanaLocation);
    blockNavigation.mockClear();
    unblock.mockClear();
    subscribe.mockClear();
    blockNavigation.mockReturnValue(unblock);
    subscribe.mockReturnValue(jest.fn());
  });

  it('should call blockNavigation when `when` is true', () => {
    const { unmount } = render(<Prompt when={true} message="Are you sure you want to leave?" />);

    expect(blockNavigation).toHaveBeenCalledWith('Are you sure you want to leave?');
    unmount();
    expect(unblock).toHaveBeenCalled();
  });

  it('should not call blockNavigation when `when` is false', () => {
    const { unmount } = render(<Prompt when={false} message="Are you sure you want to leave?" />);

    unmount();
    expect(blockNavigation).not.toHaveBeenCalled();
  });

  it('should pass the message function to blockNavigation', () => {
    const messageFn = jest.fn().mockReturnValue('Custom message');
    render(<Prompt when={true} message={messageFn} />);

    expect(blockNavigation).toHaveBeenCalledWith(messageFn);
  });
});
