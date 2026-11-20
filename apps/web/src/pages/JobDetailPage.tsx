import { Link, useParams } from 'react-router';
import {
  Button,
  PageHeader,
  PriorityLabel,
  StatusLabel,
} from '../components/ui';
import { useJob } from '../jobs/queries';
import { jobTime, jobTypeNames } from '../jobs/format';
import { statusNames } from '../design/contrast';
export function JobDetailPage() {
  const { id = '' } = useParams();
  const result = useJob(id);
  const job = result.data?.job;
  return (
    <>
      <Link to="/jobs">Back to jobs</Link>
      {result.isPending && <p role="status">Loading job...</p>}
      {result.error && (
        <div role="alert" className="error-panel">
          <p>{result.error.message}</p>
          <Button variant="secondary" onClick={() => void result.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {job && (
        <>
          <PageHeader
            title={job.job_number}
            description={`${job.customer.name} / ${job.branch.name}`}
          />
          <section className="panel stack" aria-label="Job details">
            <div className="inline-actions">
              <PriorityLabel priority={job.priority} />
              <StatusLabel status={job.current_status} />
            </div>
            <dl className="job-details">
              <dt>Type</dt>
              <dd>{jobTypeNames[job.job_type]}</dd>
              <dt>Branch address</dt>
              <dd>{job.branch.address}</dd>
              <dt>Equipment</dt>
              <dd>
                {job.equipment
                  ? `${job.equipment.label}${job.equipment.model ? ` / ${job.equipment.model}` : ''}${job.equipment.serial_number ? ` / ${job.equipment.serial_number}` : ''}`
                  : 'Not specified'}
              </dd>
              <dt>Reported</dt>
              <dd>
                <time dateTime={job.reported_at}>
                  {jobTime(job.reported_at)}
                </time>
              </dd>
              <dt>Source</dt>
              <dd>{job.source === 'manual' ? 'Manual' : 'Email'}</dd>
              <dt>Created by</dt>
              <dd>{job.created_by?.full_name ?? 'System'}</dd>
              <dt>Created</dt>
              <dd>{jobTime(job.created_at)}</dd>
              <dt>Updated</dt>
              <dd>{jobTime(job.updated_at)}</dd>
            </dl>
            <h2>Description</h2>
            <p className="job-description">{job.description}</p>
          </section>
          <section className="panel stack jobs-timeline">
            <h2>Event history</h2>
            <ol>
              {job.events.map((event) => (
                <li key={event.id}>
                  <p>
                    <strong>
                      {event.from_status
                        ? `${statusNames[event.from_status]} to `
                        : ''}
                      {statusNames[event.to_status]}
                    </strong>
                  </p>
                  <p>
                    <time dateTime={event.occurred_at}>
                      {jobTime(event.occurred_at)}
                    </time>{' '}
                    / {event.actor?.full_name ?? 'System'}
                  </p>
                  {event.reason && (
                    <p className="job-description">Reason: {event.reason}</p>
                  )}
                  {event.note && (
                    <p className="job-description">Note: {event.note}</p>
                  )}
                  {event.latitude !== null && (
                    <p className="text-secondary">
                      Location: {event.latitude}, {event.longitude}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </>
  );
}
