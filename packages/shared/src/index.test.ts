import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@chillops/shared';

describe('shared workspace package', () => {
  it('exports the application name through its package entry', () => {
    expect(APP_NAME).toBe('ChillOps');
  });
});
