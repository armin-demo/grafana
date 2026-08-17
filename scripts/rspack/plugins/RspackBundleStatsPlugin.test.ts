import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import rspack from '@rspack/core';
import { afterEach, describe, expect, it } from 'vitest';

import { RspackBundleStatsPlugin } from './RspackBundleStatsPlugin.ts';

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe('RspackBundleStatsPlugin', () => {
  let outDir: string;

  afterEach(() => {
    if (outDir) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('writes bundle-stats.html for an rspack compile', async () => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rspack-bundle-stats-'));
    const compiler = rspack({
      context: path.resolve(dirname, '../../..'),
      mode: 'production',
      // Avoid repo browserslist queries that browserslist-rs cannot parse in tests.
      target: ['web'],
      entry: './public/boot/index.ts',
      output: { path: outDir, filename: 'boot.js', clean: true },
      resolve: { extensions: ['.ts', '.js'] },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: {
              loader: 'builtin:swc-loader',
              options: { jsc: { parser: { syntax: 'typescript' } } },
            },
            type: 'javascript/auto',
          },
        ],
      },
      plugins: [new RspackBundleStatsPlugin({ reportFilename: 'bundle-stats.html' })],
    });

    await new Promise<void>((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        if (stats?.hasErrors()) {
          reject(new Error(stats.toString()));
          return;
        }
        compiler.close(() => resolve());
      });
    });

    // generateReport is async on the done hook; give it a tick.
    await new Promise((r) => setTimeout(r, 200));

    const reportPath = path.join(outDir, 'bundle-stats.html');
    expect(fs.existsSync(reportPath)).toBe(true);
    const html = fs.readFileSync(reportPath, 'utf8');
    expect(html).toContain('window.chartData');
    expect(html).toContain('boot.js');
  });
});
