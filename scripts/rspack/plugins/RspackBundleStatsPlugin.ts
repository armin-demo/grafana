import type { Compiler, Stats } from '@rspack/core';
import { createRequire } from 'node:module';
import path from 'node:path';

import { FilterStatsPlugin } from '../../webpack/plugins/FilterStatsPlugin.ts';

const require = createRequire(import.meta.url);
const viewer = require('webpack-bundle-analyzer/lib/viewer');

const STATS_TO_JSON = {
  assets: true,
  chunks: true,
  modules: true,
  chunkModules: true,
  nestedModules: true,
  reasons: true,
  ids: true,
} as const;

export interface RspackBundleStatsPluginOptions {
  reportFilename?: string;
  openAnalyzer?: boolean;
  /** When set, also write bundle-stats-filtered.html via FilterStatsPlugin. */
  filter?: { exclude?: RegExp | null; minDominance?: number };
}

/**
 * webpack-bundle-analyzer's Webpack plugin does not ask rspack for the stats
 * fields it needs (assets come back undefined → crash in getViewerData).
 * This thin wrapper feeds generateReport the same JSON shape the CLI expects.
 */
export class RspackBundleStatsPlugin {
  reportFilename: string;
  openAnalyzer: boolean;
  filter?: { exclude?: RegExp | null; minDominance?: number };

  constructor({
    reportFilename = 'bundle-stats.html',
    openAnalyzer = false,
    filter,
  }: RspackBundleStatsPluginOptions = {}) {
    this.reportFilename = reportFilename;
    this.openAnalyzer = openAnalyzer;
    this.filter = filter;
  }

  apply(compiler: Compiler) {
    compiler.hooks.done.tapPromise('RspackBundleStatsPlugin', async (stats: Stats) => {
      if (stats.hasErrors()) {
        return;
      }

      const outputPath = compiler.options.output?.path ?? path.resolve('public/build-rspack');
      const reportPath = path.join(outputPath, this.reportFilename);
      const bundleStats = stats.toJson(STATS_TO_JSON);

      // Multi-compiler / children: analyzer expects a flat assets list.
      if ((!bundleStats.assets || bundleStats.assets.length === 0) && Array.isArray(bundleStats.children)) {
        bundleStats.assets = [];
        for (const child of bundleStats.children) {
          if (Array.isArray(child.assets)) {
            bundleStats.assets.push(...child.assets);
          }
        }
      }

      await viewer.generateReport(bundleStats, {
        reportFilename: reportPath,
        reportTitle: 'Grafana rspack bundle',
        bundleDir: outputPath,
        openBrowser: this.openAnalyzer,
        defaultSizes: 'parsed',
      });

      if (this.filter) {
        new FilterStatsPlugin(this.filter).writeFilteredReport({
          statsPath: reportPath,
          filteredPath: path.join(outputPath, 'bundle-stats-filtered.html'),
        });
      }
    });
  }
}
