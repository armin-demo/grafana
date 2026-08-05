/**
 * Minimal location shape used across Grafana.
 * Intentionally not tied to the abandoned history@4 package so public APIs can migrate off it.
 *
 * @public
 */
export interface GrafanaLocation<S = unknown> {
  pathname: string;
  search: string;
  hash: string;
  /** Mirrors history@4 Location.state (required property; value may be undefined). */
  state: S;
  key?: string;
}
