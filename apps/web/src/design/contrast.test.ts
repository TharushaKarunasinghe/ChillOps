import { readFileSync } from 'node:fs';
import { format } from 'prettier';
import { describe, expect, it } from 'vitest';
import { contrastMarkdown, contrastRatio, evaluateContrast } from './contrast';

const css = readFileSync(
  new URL('../styles/tokens.css', import.meta.url),
  'utf8',
);

describe('design contrast', () => {
  it('uses WCAG relative luminance', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
  });

  it.each(evaluateContrast(css).filter((pair) => pair.minimum > 0))(
    '$purpose: $foreground on $background',
    (pair) => {
      expect(pair.ratio).toBeGreaterThanOrEqual(pair.minimum);
    },
  );

  it('keeps the generated report synchronized with the CSS tokens', async () => {
    const actual = readFileSync(
      new URL('../../../../docs/design-contrast.md', import.meta.url),
      'utf8',
    );
    expect(actual.replace(/\r\n/g, '\n')).toBe(
      await format(contrastMarkdown(css), { parser: 'markdown' }),
    );
  });
});
