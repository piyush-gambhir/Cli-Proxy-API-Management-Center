



import { describe, expect, mock, test } from 'bun:test';
import { join } from 'node:path';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_VISUAL_VALUES } from '@/types/visualConfig';
import { resolveRowSpans } from '@/features/config/components/fields/rowSpans';


mock.module(
  join(import.meta.dir, '../src/features/config/components/fields/Field.module.scss'),
  () => ({
    default: new Proxy({}, { get: (_, key) => (typeof key === 'string' ? key : undefined) }),
  })
);

const { I18nextProvider } = await import('react-i18next');
const { default: i18n } = await import('@/i18n');
const sections = {
  common: (await import('@/features/config/components/sections/SectionCommon')).SectionCommon,
  connectivity: (await import('@/features/config/components/sections/SectionConnectivity'))
    .SectionConnectivity,
  network: (await import('@/features/config/components/sections/SectionNetwork')).SectionNetwork,
  logging: (await import('@/features/config/components/sections/SectionLogging')).SectionLogging,
  streaming: (await import('@/features/config/components/sections/SectionStreaming'))
    .SectionStreaming,
  advanced: (await import('@/features/config/components/sections/SectionAdvanced')).SectionAdvanced,
} as Record<string, ComponentType<Record<string, unknown>>>;

const translations = i18n.cloneInstance({ lng: 'en' });
const render = (Section: ComponentType<Record<string, unknown>>, tlsEnable: boolean) =>
  renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n: translations },
      createElement(Section, {
        values: { ...DEFAULT_VISUAL_VALUES, tlsEnable },
        disabled: false,
        onChange: () => {},
      })
    )
  );


function listsOf(markup: string) {
  return markup
    .split('class="list"')
    .slice(1)
    .map((chunk) =>
      [...chunk.split('class="group"')[0].matchAll(/<div id="cfg-field-([^"]+)" class="([^"]*)"/g)]
        .filter(([, , classes]) => classes.split(' ').includes('row'))
        .map(([, fieldId, classes]) => ({ fieldId, wide: classes.split(' ').includes('rowWide') }))
    );
}

describe('two-column setting layout', () => {
  for (const [name, Section] of Object.entries(sections)) {
    for (const tlsEnable of name === 'connectivity' ? [false, true] : [false]) {
      test(`${name}${tlsEnable ? ' (TLS on)' : ''}: no list leaves a half-empty row`, () => {
        const lists = listsOf(render(Section, tlsEnable));
        expect(lists.length).toBeGreaterThan(0);
        for (const rows of lists) {
          expect(rows.length).toBeGreaterThan(0);
          const wide = rows.map((row) => row.wide);

          expect({ rows: rows.map((row) => row.fieldId), wide: resolveRowSpans(wide) }).toEqual({
            rows: rows.map((row) => row.fieldId),
            wide,
          });
        }
      });
    }
  }

  test('long URL and master switches keep their deliberate full-width rows', () => {
    const common = listsOf(render(sections.common, false)).flat();
    const network = listsOf(render(sections.network, false)).flat();
    const connectivity = listsOf(render(sections.connectivity, true)).flat();
    const wideOf = (rows: typeof common, fieldId: string) =>
      rows.find((row) => row.fieldId === fieldId)?.wide;
    expect(wideOf(common, 'proxyUrl')).toBe(true);
    expect(wideOf(network, 'proxyUrl')).toBe(true);
    expect(wideOf(network, 'requestRetry')).toBe(false);
    expect(wideOf(connectivity, 'tlsEnable')).toBe(true);
    expect(wideOf(connectivity, 'tlsCert')).toBe(false);
    expect(wideOf(connectivity, 'tlsKey')).toBe(false);
  });
});
