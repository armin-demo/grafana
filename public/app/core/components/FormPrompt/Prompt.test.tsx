import { render } from 'test/test-utils';

import { type GrafanaLocation } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { Prompt } from './Prompt';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getLocation: jest.fn(),
    blockNavigation: jest.fn(),
  },
}));

describe('Prompt component', () => {
  const unblock = jest.fn();

  beforeEach(() => {
    (locationService.blockNavigation as jest.Mock).mockReturnValue(unblock);
    (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/current' } as GrafanaLocation);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call blockNavigation when `when` is true', () => {
    const { unmount } = render(<Prompt when={true} message="Are you sure you want to leave?" />);

    expect(locationService.blockNavigation).toHaveBeenCalledWith('Are you sure you want to leave?');
    unmount();
    expect(unblock).toHaveBeenCalled();
  });

  it('should not call blockNavigation when `when` is false', () => {
    const { unmount } = render(<Prompt when={false} message="Are you sure you want to leave?" />);

    unmount();
    expect(locationService.blockNavigation).not.toHaveBeenCalled();
  });

  it('should pass the message function to blockNavigation', () => {
    const messageFn = jest.fn().mockReturnValue('Custom message');
    render(<Prompt when={true} message={messageFn} />);

    expect(locationService.blockNavigation).toHaveBeenCalledWith(messageFn);
  });
});
