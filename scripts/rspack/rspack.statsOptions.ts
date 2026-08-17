/**
 * Stats payload webpack-bundle-analyzer needs under rspack.
 * Rspack's default `toJson()` omits modules/chunks/assets, which makes the
 * analyzer throw (`Cannot read properties of undefined (reading 'filter')`).
 */
export const rspackBundleAnalyzerStatsOptions = {
  all: false,
  assets: true,
  chunks: true,
  modules: true,
  chunkModules: true,
  nestedModules: true,
  ids: true,
  hash: true,
} as const;
