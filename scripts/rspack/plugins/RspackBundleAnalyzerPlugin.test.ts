import type { StatsCompilation } from '@rspack/core';
import { describe, expect, it } from 'vitest';

import { normalizeRspackStatsForAnalyzer } from './RspackBundleAnalyzerPlugin.ts';

describe('normalizeRspackStatsForAnalyzer', () => {
  it('drops orphan/runtime placeholders and keeps identifiable modules', () => {
    const normalized = normalizeRspackStatsForAnalyzer({
      modules: [
        { type: 'orphan modules', size: 10 },
        { type: 'runtime modules', size: 5 },
        {
          type: 'module',
          identifier: 'app.ts',
          name: './app.ts + 2 modules',
          size: 20,
          modules: [
            { type: 'orphan modules', filteredChildren: 2, size: 20 },
            { type: 'module', identifier: 'child.ts', name: './child.ts', size: 8 },
          ],
        },
      ],
      chunks: [
        {
          id: 1,
          modules: [
            { type: 'orphan modules', size: 1 },
            { type: 'module', identifier: 'chunk.ts', name: './chunk.ts', size: 3 },
          ],
        },
      ],
    } as StatsCompilation);

    expect(normalized.modules).toHaveLength(1);
    expect(normalized.modules?.[0].identifier).toBe('app.ts');
    expect(normalized.modules?.[0].modules).toHaveLength(1);
    expect(normalized.modules?.[0].modules?.[0].identifier).toBe('child.ts');
    expect(normalized.chunks?.[0].modules).toHaveLength(1);
    expect(normalized.chunks?.[0].modules?.[0].identifier).toBe('chunk.ts');
  });
});
