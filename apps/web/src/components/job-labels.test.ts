import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JOB_STATUSES } from '@chillops/shared';
import { JOB_PRIORITIES } from '@chillops/shared/jobs';
import { PriorityLabel, StatusLabel } from './ui';
import { statusNames } from '../design/contrast';
import { priorityNames, jobTime, jobAge } from '../jobs/format';
describe('job display', () => {
  for (const priority of JOB_PRIORITIES)
    it(`renders ${priority} text and its treatment`, () => {
      const markup = renderToStaticMarkup(
        createElement(PriorityLabel, { priority }),
      );
      expect(markup).toContain(`priority-${priority}`);
      expect(markup).toContain(`>${priorityNames[priority]}</span>`);
    });
  for (const status of JOB_STATUSES)
    it(`renders ${status} text`, () => {
      expect(
        renderToStaticMarkup(createElement(StatusLabel, { status })),
      ).toContain(`>${statusNames[status]}</span>`);
    });
  it('formats UTC times in Colombo and readable elapsed age', () => {
    expect(jobTime('2026-01-01T00:00:00Z')).toContain('05:30');
    expect(jobTime('2026-01-01T20:00:00Z')).toContain('02 Jan 2026');
    expect(
      jobAge('2026-01-01T00:00:00Z', Date.parse('2026-01-02T01:00:00Z')),
    ).toBe('1d 1h');
  });
});
