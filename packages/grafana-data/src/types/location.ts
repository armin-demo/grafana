/**
 * Grafana-owned location shape used by navigation helpers and locationService.
 * Structurally compatible with history@4 `Location`, but owned here so public
 * `@grafana/data` / `@grafana/runtime` APIs do not depend on the abandoned history package.
 *
 * @public
 */
export interface GrafanaLocation<S = unknown> {
  pathname: string;
  search: string;
  hash: string;
  state: S;
  key?: string;
}

/**
 * Partial location used for push/replace style navigation.
 *
 * @public
 */
export interface GrafanaLocationDescriptorObject<S = unknown> {
  pathname?: string;
  search?: string;
  hash?: string;
  state?: S;
  key?: string;
}

/**
 * Path string or partial location descriptor for navigation.
 *
 * @public
 */
export type GrafanaLocationDescriptor<S = unknown> = string | GrafanaLocationDescriptorObject<S>;
