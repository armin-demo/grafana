import fs from 'fs';
import os from 'os';
import path from 'path';

import { FilterStatsPlugin, type BundleNode } from '../webpack/plugins/FilterStatsPlugin';

function wrapChartData(nodes: BundleNode[]): string {
  return `<!doctype html><html><body><script>window.chartData = ${JSON.stringify(nodes)};</script></body></html>`;
}

describe('FilterStatsPlugin', () => {
  let tmpDir: string;
  let statsPath: string;
  let filteredPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-stats-'));
    statsPath = path.join(tmpDir, 'bundle-stats.html');
    filteredPath = path.join(tmpDir, 'bundle-stats-filtered.html');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('copies the report unchanged when no exclude is set', () => {
    const html = wrapChartData([{ label: 'app.js', parsedSize: 100 }]);
    fs.writeFileSync(statsPath, html);

    new FilterStatsPlugin().writeFilteredReport({ statsPath, filteredPath });

    expect(fs.readFileSync(filteredPath, 'utf8')).toBe(html);
  });

  it('drops bundles dominated by an excluded module (smolstats)', () => {
    const nodes: BundleNode[] = [
      {
        label: 'monaco-chunk.js',
        parsedSize: 1000,
        groups: [{ label: 'node_modules/monaco-editor/esm/vs/editor.js', parsedSize: 900 }],
      },
      {
        label: 'app.js',
        parsedSize: 500,
        groups: [{ label: 'public/app/core/index.ts', parsedSize: 400 }],
      },
    ];
    fs.writeFileSync(statsPath, wrapChartData(nodes));

    new FilterStatsPlugin({
      exclude: /@kusto|monaco-editor|public\/locales/,
      minDominance: 0.75,
    }).writeFilteredReport({ statsPath, filteredPath });

    const filteredHtml = fs.readFileSync(filteredPath, 'utf8');
    const match = filteredHtml.match(/window\.chartData = (\[.*?\]);/);
    expect(match).not.toBeNull();
    const filtered: BundleNode[] = JSON.parse(match![1]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].label).toBe('app.js');
  });

  it('keeps a composite bundle when the excluded module is below minDominance', () => {
    const nodes: BundleNode[] = [
      {
        label: 'mixed.js',
        parsedSize: 1000,
        groups: [
          { label: 'node_modules/monaco-editor/index.js', parsedSize: 200 },
          { label: 'public/app/features/dashboard/index.ts', parsedSize: 800 },
        ],
      },
    ];
    fs.writeFileSync(statsPath, wrapChartData(nodes));

    new FilterStatsPlugin({
      exclude: /monaco-editor/,
      minDominance: 0.75,
    }).writeFilteredReport({ statsPath, filteredPath });

    const match = fs.readFileSync(filteredPath, 'utf8').match(/window\.chartData = (\[.*?\]);/);
    const filtered: BundleNode[] = JSON.parse(match![1]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].label).toBe('mixed.js');
  });

  it('registers on the compiler done hook', () => {
    const taps: Array<{ name: string; cb: () => void }> = [];
    const compiler = {
      hooks: {
        done: {
          tap: (name: string, cb: () => void) => {
            taps.push({ name, cb });
          },
        },
      },
    };

    new FilterStatsPlugin({ exclude: /monaco-editor/ }).apply(compiler);

    expect(taps).toHaveLength(1);
    expect(taps[0].name).toBe('FilterStatsPlugin');
    expect(typeof taps[0].cb).toBe('function');
  });
});
