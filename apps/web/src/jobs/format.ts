import { jobAgeMinutes } from '@chillops/shared/jobs';
const colombo = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
export function jobTime(value: string): string {
  return `${colombo.format(new Date(value))} (Colombo)`;
}
export function jobAge(value: string, now = Date.now()): string {
  const minutes = jobAgeMinutes(value, now);
  return minutes >= 1440
    ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
    : minutes >= 60
      ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
      : `${minutes}m`;
}
export const jobTypeNames = {
  breakdown: 'Breakdown',
  planned_service: 'Planned service',
};
export const priorityNames = {
  critical: 'Critical',
  urgent: 'Urgent',
  routine: 'Routine',
};
