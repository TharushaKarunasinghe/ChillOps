export const APP_NAME = 'ChillOps';
export const JOB_STATUSES = [
  'unassigned',
  'assigned',
  'in_transit',
  'on_site',
  'completed',
  'pending',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
