import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { format } from 'prettier';
import { contrastMarkdown } from '../src/design/contrast.ts';

const css = await readFile(
  new URL('../src/styles/tokens.css', import.meta.url),
  'utf8',
);
const destination = new URL(
  '../../../docs/design-contrast.md',
  import.meta.url,
);
await mkdir(new URL('../../../docs/', import.meta.url), { recursive: true });
await writeFile(
  destination,
  await format(contrastMarkdown(css), { parser: 'markdown' }),
);
