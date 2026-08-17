import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';
import type { Configuration } from '@rspack/core';
import { merge } from 'webpack-merge';

import { FilterStatsPlugin } from '../webpack/plugins/FilterStatsPlugin.ts';

import RspackBundleAnalyzerPlugin from './plugins/RspackBundleAnalyzerPlugin.ts';
import type { Env } from './rspack.common.ts';
import prodConfig from './rspack.prod.ts';
import { rspackBundleAnalyzerStatsOptions } from './rspack.statsOptions.ts';

const RSPACK_STATS_PATH = 'public/build-rspack/bundle-stats.html';
const RSPACK_STATS_PATH_FILT = 'public/build-rspack/bundle-stats-filtered.html';

/**
 * Bundle analysis config for the rspack production build.
 *
 * Mirrors scripts/webpack/webpack.stats.ts so `yarn build:stats:rspack`,
 * `yarn build:smolstats:rspack`, and doctor/namedChunks flags analyse the
 * assets contributors actually ship once rspack is the day-to-day bundler.
 *
 * Tracked outside grafana/grafana#129728 (which listed config twins / nx
 * targets but not webpack.stats.ts). This is developer tooling — nothing in
 * CI consumes the HTML reports — so it can land after the core config port.
 */
export default (env: Env = {}) => {
  const config: Configuration = {
    stats: { ...rspackBundleAnalyzerStatsOptions },
    // Module concatenation collapses identifiers in a way webpack-bundle-analyzer
    // cannot walk under rspack (orphan-module placeholders). Stats builds opt out.
    optimization: {
      concatenateModules: false,
    },
    plugins: [
      new RspackBundleAnalyzerPlugin(
        env.filtered
          ? {
              analyzerMode: 'static',
              reportFilename: 'bundle-stats.html',
              openAnalyzer: false,
            }
          : env.statsJson
            ? {
                analyzerMode: 'disabled',
              }
            : {
                analyzerMode: 'server',
                openAnalyzer: false,
              }
      ),
    ],
  };

  // yarn build:smolstats:rspack
  if (env.filtered) {
    config.plugins?.push(
      new FilterStatsPlugin({
        exclude: /@kusto|monaco-editor|public\/locales/,
        minDominance: 0.75,
        statsPath: RSPACK_STATS_PATH,
        filteredStatsPath: RSPACK_STATS_PATH_FILT,
      }) as never
    );
  }

  // yarn build:stats:rspack --env doctor
  if (env.doctor) {
    config.plugins?.push(new RsdoctorRspackPlugin());
  }

  // disable hashing in output filenames to make them easier to identify
  // yarn build:stats:rspack --env doctor --env namedChunks
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
