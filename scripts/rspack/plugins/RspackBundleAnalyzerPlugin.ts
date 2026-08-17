import type { Compiler, Stats, StatsCompilation, StatsModule } from '@rspack/core';
import { createRequire } from 'node:module';
import path from 'node:path';

import { rspackBundleAnalyzerStatsOptions } from '../rspack.statsOptions.ts';

const require = createRequire(import.meta.url);
// viewer helpers are not re-exported from the package root
const viewer = require('webpack-bundle-analyzer/lib/viewer.js') as {
  generateReport: (stats: object, opts: Record<string, unknown>) => Promise<void>;
  startServer: (stats: object, opts: Record<string, unknown>) => Promise<unknown>;
};
const { defaultTitle } = require('webpack-bundle-analyzer/lib/utils.js') as {
  defaultTitle: () => string;
};

export interface RspackBundleAnalyzerPluginOptions {
  analyzerMode?: 'server' | 'static' | 'json' | 'disabled';
  reportFilename?: string;
  openAnalyzer?: boolean;
  defaultSizes?: 'parsed' | 'stat' | 'gzip';
  excludeAssets?: RegExp | null;
}

/**
 * Rspack emits placeholder stats rows (`orphan modules` / `runtime modules`) that
 * webpack-bundle-analyzer cannot walk. Drop anything without an identifier/name.
 */
export function normalizeRspackStatsForAnalyzer(stats: StatsCompilation): StatsCompilation {
  const clean = (mods: StatsModule[] | undefined): StatsModule[] | undefined => {
    if (!Array.isArray(mods)) {
      return mods;
    }
    return mods
      .filter(
        (m) =>
          m &&
          (m.identifier || m.name) &&
          m.type !== 'orphan modules' &&
          m.type !== 'runtime modules'
      )
      .map((m) => ({
        ...m,
        modules: clean(m.modules),
      }));
  };

  const normalized: StatsCompilation = {
    ...stats,
    modules: clean(stats.modules),
  };

  if (Array.isArray(normalized.chunks)) {
    normalized.chunks = normalized.chunks.map((chunk) => ({
      ...chunk,
      modules: clean(chunk.modules),
    }));
  }

  return normalized;
}

/**
 * webpack-bundle-analyzer's plugin calls `stats.toJson()` with no options.
 * Rspack's default JSON omits modules/chunks/assets, which crashes the
 * analyzer. This thin wrapper asks rspack for a full stats payload first.
 */
export default class RspackBundleAnalyzerPlugin {
  private opts: Required<
    Pick<RspackBundleAnalyzerPluginOptions, 'analyzerMode' | 'reportFilename' | 'openAnalyzer' | 'defaultSizes'>
  > &
    RspackBundleAnalyzerPluginOptions;

  private server: Promise<unknown> | null = null;

  constructor(opts: RspackBundleAnalyzerPluginOptions = {}) {
    this.opts = {
      analyzerMode: 'server',
      reportFilename: 'report.html',
      openAnalyzer: true,
      defaultSizes: 'parsed',
      ...opts,
    };
  }

  apply(compiler: Compiler) {
    compiler.hooks.done.tapAsync({ name: 'RspackBundleAnalyzerPlugin', stage: 0 }, async (stats: Stats, callback) => {
      if (this.opts.analyzerMode === 'disabled') {
        callback();
        return;
      }

      try {
        const json = normalizeRspackStatsForAnalyzer(stats.toJson({ ...rspackBundleAnalyzerStatsOptions }));
        const bundleDir = compiler.outputPath;

        if (this.opts.analyzerMode === 'static') {
          await viewer.generateReport(json, {
            openBrowser: this.opts.openAnalyzer,
            reportFilename: path.resolve(bundleDir, this.opts.reportFilename),
            reportTitle: defaultTitle,
            bundleDir,
            defaultSizes: this.opts.defaultSizes,
            excludeAssets: this.opts.excludeAssets,
          });
        } else if (this.opts.analyzerMode === 'server') {
          if (this.server) {
            const server = (await this.server) as { updateChartData?: (s: object) => void };
            server.updateChartData?.(json);
          } else {
            this.server = viewer.startServer(json, {
              openBrowser: this.opts.openAnalyzer,
              reportTitle: defaultTitle,
              bundleDir,
              defaultSizes: this.opts.defaultSizes,
              excludeAssets: this.opts.excludeAssets,
            });
            await this.server;
          }
        }

        callback();
      } catch (error) {
        callback(error as Error);
      }
    });
  }
}
