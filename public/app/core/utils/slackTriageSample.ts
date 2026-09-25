/**
 * Marker used by the #user-feedback Slack triage automation sample (Linear CS-933).
 * Safe to delete if the sample PR is closed without merging.
 */
export const SLACK_TRIAGE_SAMPLE_ID = 'CS-933';

export function getSlackTriageSampleMarker(): string {
  return `linear:${SLACK_TRIAGE_SAMPLE_ID}`;
}
