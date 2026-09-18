import { readFileSync } from 'fs';
import path from 'path';

const plugin = JSON.parse(readFileSync(path.resolve(__dirname, 'plugin.json'), 'utf8')) as {
  id: string;
  type: string;
  name: string;
  info: { logos: { small: string; large: string }; version: string };
  dependencies: { grafanaDependency: string };
};

describe('canvas plugin.json', () => {
  it('uses the production Canvas title, core icon, and Grafana 13.3.0 compatibility', () => {
    expect(plugin.id).toBe('canvas');
    expect(plugin.type).toBe('panel');
    expect(plugin.name).toBe('Canvas');
    expect(plugin.info.logos.small).toBe('img/icn-canvas.svg');
    expect(plugin.info.logos.large).toBe('img/icn-canvas.svg');
    expect(plugin.info.version).toBe('13.3.0');
    expect(plugin.dependencies.grafanaDependency).toBe('>=13.3.0');
  });
});
