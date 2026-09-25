import { getSlackTriageSampleMarker, SLACK_TRIAGE_SAMPLE_ID } from './slackTriageSample';

describe('slackTriageSample', () => {
  it('returns a Linear-prefixed marker for the sample ticket', () => {
    expect(SLACK_TRIAGE_SAMPLE_ID).toBe('CS-933');
    expect(getSlackTriageSampleMarker()).toBe('linear:CS-933');
  });
});
