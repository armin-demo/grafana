import fs from 'fs';
import type { Compiler } from 'webpack';

const DEFAULT_STATS_PATH = 'public/build/bundle-stats.html';
const DEFAULT_STATS_PATH_FILT = 'public/build/bundle-stats-filtered.html';

interface BundleNode {
  label: string;
  parsedSize: number;
  groups?: BundleNode[];
}

export interface FilterStatsPluginOptions {
  exclude?: RegExp | null;
  minDominance?: number;
  /** Path to the raw webpack-bundle-analyzer HTML report. */
  statsPath?: string;
  /** Path where the filtered HTML report is written. */
  filteredStatsPath?: string;
}

export class FilterStatsPlugin {
  // exclusion regexp
  exclude: RegExp | null = null;

  // we should only filter out bundles where the matched descendent occupies more than 75% of the bundle's size
  // this way we don't ignore a composite bundle when some previously-decoupled & excluded component accidentally moves into it
  minDominance = 0.75;

  statsPath: string;
  filteredStatsPath: string;

  constructor({
    exclude = null,
    minDominance = 0.75,
    statsPath = DEFAULT_STATS_PATH,
    filteredStatsPath = DEFAULT_STATS_PATH_FILT,
  }: FilterStatsPluginOptions = {}) {
    this.exclude = exclude;
    this.minDominance = minDominance;
    this.statsPath = statsPath;
    this.filteredStatsPath = filteredStatsPath;
  }

  apply(compiler: Compiler) {
    // Run after bundle-analyzer plugins (stage 0) have written the HTML report.
    compiler.hooks.done.tapAsync({ name: 'FilterStatsPlugin', stage: 100 }, (_stats, callback) => {
      try {
        if (!fs.existsSync(this.statsPath)) {
          const logger = compiler.getInfrastructureLogger('FilterStatsPlugin');
          logger.error(`Bundle stats report not found at ${this.statsPath}; skipping filter step`);
          callback();
          return;
        }

        if (this.exclude == null) {
          fs.copyFileSync(this.statsPath, this.filteredStatsPath);
        } else {
          const exclude = this.exclude;
          const statsHTML = fs.readFileSync(this.statsPath, 'utf8');
          const filteredStatsHTML = statsHTML.replace(/(window.chartData = )(\[.*?\])(;)/, (_, head, data, tail) => {
            const nodes: BundleNode[] = JSON.parse(data);
            const filtered = nodes.filter((node) => !this.pathContains(node, node.parsedSize, exclude));
            return head + JSON.stringify(filtered) + tail;
          });

          fs.writeFileSync(this.filteredStatsPath, filteredStatsHTML);
        }
        callback();
      } catch (error) {
        callback(error as Error);
      }
    });
  }

  pathContains(node: BundleNode, rootParsedSize: number, exclude: RegExp): boolean {
    if (node.parsedSize / rootParsedSize >= this.minDominance) {
      if (exclude.test(node.label)) {
        return true;
      }

      if (node.groups != null) {
        for (let i = 0; i < node.groups.length; i++) {
          if (this.pathContains(node.groups[i], rootParsedSize, exclude)) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
