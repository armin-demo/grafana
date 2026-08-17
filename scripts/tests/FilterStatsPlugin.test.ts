import fs from 'fs';
import os from 'os';
import path from 'path';

import { FilterStatsPlugin } from '../webpack/plugins/FilterStatsPlugin.ts';

function writeStatsHtml(filePath: string, chartData: unknown) {
  fs.writeFileSync(filePath, `window.chartData = ${JSON.stringify(chartData)};`);
}

function runPluginDone(plugin: FilterStatsPlugin) {
  return new Promise<void>((resolve, reject) => {
    plugin.apply({
      getInfrastructureLogger: () => ({ error: () => undefined }),
      hooks: {
        done: {
          tapAsync: (
            _opts: { name: string; stage?: number },
            fn: (_stats: unknown, callback: (error?: Error) => void) => void
          ) => {
            fn(undefined, (error) => (error ? reject(error) : resolve()));
          },
        },
      },
    } as never);
  });
}

describe('FilterStatsPlugin', () => {
  let tmpDir: string;
  let statsPath: string;
  let filteredStatsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-stats-'));
    statsPath = path.join(tmpDir, 'bundle-stats.html');
    filteredStatsPath = path.join(tmpDir, 'bundle-stats-filtered.html');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('copies the report when no exclude pattern is set', async () => {
    writeStatsHtml(statsPath, [{ label: 'app.js', parsedSize: 100 }]);

    await runPluginDone(new FilterStatsPlugin({ statsPath, filteredStatsPath }));

    expect(fs.readFileSync(filteredStatsPath, 'utf8')).toBe(fs.readFileSync(statsPath, 'utf8'));
  });

  it('filters dominant excluded bundles from chartData', async () => {
    writeStatsHtml(statsPath, [
      {
        label: 'vendor.js',
        parsedSize: 1000,
        groups: [{ label: 'node_modules/monaco-editor/index.js', parsedSize: 900 }],
      },
      {
        label: 'app.js',
        parsedSize: 200,
        groups: [{ label: 'public/app/index.ts', parsedSize: 200 }],
      },
    ]);

    await runPluginDone(
      new FilterStatsPlugin({
        exclude: /monaco-editor/,
        minDominance: 0.75,
        statsPath,
        filteredStatsPath,
      })
    );

    const html = fs.readFileSync(filteredStatsPath, 'utf8');
    const match = html.match(/window\.chartData = (\[.*?\]);/);
    expect(match).not.toBeNull();
    const filtered = JSON.parse(match![1]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].label).toBe('app.js');
  });

  it('keeps bundles when the excluded path is not dominant', async () => {
    writeStatsHtml(statsPath, [
      {
        label: 'vendor.js',
        parsedSize: 1000,
        groups: [
          { label: 'node_modules/monaco-editor/index.js', parsedSize: 100 },
          { label: 'node_modules/lodash/index.js', parsedSize: 900 },
        ],
      },
    ]);

    await runPluginDone(
      new FilterStatsPlugin({
        exclude: /monaco-editor/,
        minDominance: 0.75,
        statsPath,
        filteredStatsPath,
      })
    );

    const html = fs.readFileSync(filteredStatsPath, 'utf8');
    const match = html.match(/window\.chartData = (\[.*?\]);/);
    const filtered = JSON.parse(match![1]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].label).toBe('vendor.js');
  });

  it('skips filtering when the stats report is missing', async () => {
    await runPluginDone(new FilterStatsPlugin({ statsPath, filteredStatsPath }));
    expect(fs.existsSync(filteredStatsPath)).toBe(false);
  });
});
