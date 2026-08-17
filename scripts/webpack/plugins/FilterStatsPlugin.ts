import fs from 'fs';
import path from 'path';

const DEFAULT_STATS_FILE = 'bundle-stats.html';
const DEFAULT_FILTERED_FILE = 'bundle-stats-filtered.html';

export interface BundleNode {
  label: string;
  parsedSize: number;
  groups?: BundleNode[];
}

/** Minimal compiler surface shared by webpack and rspack. */
interface StatsCompiler {
  options?: {
    output?: {
      path?: string;
    };
  };
  hooks: {
    done: {
      tap: (name: string, callback: () => void) => void;
    };
  };
}

export class FilterStatsPlugin {
  // exclusion regexp
  exclude: RegExp | null = null;

  // we should only filter out bundles where the matched descendent occupies more than 75% of the bundle's size
  // this way we don't ignore a composite bundle when some previously-decoupled & excluded component accidentally moves into it
  minDominance = 0.75;

  constructor({ exclude = null, minDominance = 0.75 }: { exclude?: RegExp | null; minDominance?: number } = {}) {
    this.exclude = exclude;
    this.minDominance = minDominance;
  }

  apply(compiler: StatsCompiler) {
    compiler.hooks.done.tap('FilterStatsPlugin', () => {
      const outputPath = compiler.options?.output?.path ?? path.resolve('public/build');
      this.writeFilteredReport({
        statsPath: path.join(outputPath, DEFAULT_STATS_FILE),
        filteredPath: path.join(outputPath, DEFAULT_FILTERED_FILE),
      });
    });
  }

  /** Filter chartData in place. Exposed for unit tests without a full compile. */
  writeFilteredReport({
    statsPath,
    filteredPath,
  }: {
    statsPath: string;
    filteredPath: string;
  }) {
    if (this.exclude == null) {
      fs.copyFileSync(statsPath, filteredPath);
      return;
    }

    const exclude = this.exclude;
    const statsHTML = fs.readFileSync(statsPath, 'utf8');
    const filteredStatsHTML = statsHTML.replace(/(window.chartData = )(\[.*?\])(;)/, (_, head, data, tail) => {
      const nodes: BundleNode[] = JSON.parse(data);
      const filtered = nodes.filter((node) => !this.pathContains(node, node.parsedSize, exclude));
      return head + JSON.stringify(filtered) + tail;
    });

    fs.writeFileSync(filteredPath, filteredStatsHTML);
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
