import type { Configuration } from '@rspack/core';
import { merge } from 'webpack-merge';

import { RspackBundleStatsPlugin } from './plugins/RspackBundleStatsPlugin.ts';
import type { Env } from './rspack.common.ts';
import prodConfig from './rspack.prod.ts';

/**
 * Rspack twin of scripts/webpack/webpack.stats.ts.
 *
 * yarn build:stats:rspack / build:smolstats:rspack / stats:rspack analyse the
 * rspack production bundle — the webpack stats scripts keep analysing webpack.
 *
 * Uses RspackBundleStatsPlugin instead of webpack-bundle-analyzer's Webpack
 * plugin: the latter's done-hook stats request omits `assets` under rspack and
 * crashes in getViewerData.
 */
export default (env: Env = {}) => {
  const config: Configuration = {
    plugins: [
      new RspackBundleStatsPlugin({
        reportFilename: 'bundle-stats.html',
        openAnalyzer: false,
        filter: env.filtered
          ? {
              exclude: /@kusto|monaco-editor|public\/locales/,
              minDominance: 0.75,
            }
          : undefined,
      }),
    ],
  };

  // yarn build:stats:rspack --env namedChunks
  if (env.namedChunks) {
    config.optimization = {
      chunkIds: 'named',
    };
    config.output = {
      filename: '[name].js',
      chunkFilename: '[name].js',
    };
  }

  const baseConfig = prodConfig(env);

  if (Array.isArray(baseConfig)) {
    // yarn build:stats:rspack --env configName=swagger
    if (!env.configName) {
      env.configName = baseConfig[0].name;
    }

    const namedConfig = baseConfig.find((c) => c.name === env.configName);
    if (!namedConfig) {
      throw new Error(`No config found with name ${env.configName}`);
    }

    return merge(namedConfig, config);
  }

  return merge(baseConfig, config);
};
