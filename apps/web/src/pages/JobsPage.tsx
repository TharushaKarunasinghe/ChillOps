import { Link, useSearchParams } from 'react-router';
import { JOB_STATUSES } from '@chillops/shared';
import { JOB_PRIORITIES, listJobsQuerySchema } from '@chillops/shared/jobs';
import { useAuth } from '../auth/AuthContext';
import {
  Button,
  FormField,
  PageHeader,
  PriorityLabel,
  Select,
  StatusLabel,
  Table,
} from '../components/ui';
import { statusNames } from '../design/contrast';
import { useJobs } from '../jobs/queries';
import { jobAge, jobTime, jobTypeNames, priorityNames } from '../jobs/format';

export function JobsPage() {
  const [params, setParams] = useSearchParams();
  const raw = Object.fromEntries(params);
  const selectedStatus = params.get('status') ?? 'unassigned,pending';
  const parsed = listJobsQuerySchema.safeParse({
    ...raw,
    status: selectedStatus === 'all' ? undefined : selectedStatus,
  });
  if (!parsed.success)
    return (
      <>
        <PageHeader title="Jobs" />
        <p role="alert">Invalid job filters.</p>
        <Link to="/jobs">Reset filters</Link>
      </>
    );
  return (
    <JobsList
      query={parsed.data}
      selectedStatus={selectedStatus}
      update={(name, value) => {
        const next = new URLSearchParams(params);
        if (value) next.set(name, value);
        else next.delete(name);
        if (name !== 'page') next.delete('page');
        setParams(next);
      }}
    />
  );
}
function JobsList({
  query,
  selectedStatus,
  update,
}: {
  query: ReturnType<typeof listJobsQuerySchema.parse>;
  selectedStatus: string;
  update: (name: string, value: string) => void;
}) {
  const { user } = useAuth();
  const result = useJobs(query);
  const data = result.data;
  return (
    <>
      <PageHeader
        title="Jobs"
        description="Critical first, then urgent and routine. Oldest reports first within each priority."
        actions={
          user?.role === 'ops' ? (
            <Link className="button button-primary" to="/jobs/new">
              New job
            </Link>
          ) : undefined
        }
      />
      <div className="jobs-filters">
        <FormField label="Status">
          <Select
            value={selectedStatus}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="unassigned,pending">Needs action</option>
            <option value="all">All statuses</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusNames[s]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Priority">
          <Select
            value={query.priority ?? ''}
            onChange={(e) => update('priority', e.target.value)}
          >
            <option value="">All priorities</option>
            {JOB_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {priorityNames[p]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {result.isPending && <p role="status">Loading jobs...</p>}
      {result.error && (
        <div role="alert" className="error-panel">
          <p>
            {data ? 'Refresh failed. Displaying the last loaded results. ' : ''}
            {result.error.message}
          </p>
          <Button variant="secondary" onClick={() => void result.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {data && (
        <>
          <Table caption="Jobs matching the selected filters. Age is time since reporting.">
            <thead>
              <tr>
                {[
                  'Job number',
                  'Customer',
                  'Branch',
                  'Type',
                  'Priority',
                  'Status',
                  'Age',
                ].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((job) => (
                <tr key={job.id}>
                  <td className="id-cell">
                    <Link to={`/jobs/${job.id}`}>{job.job_number}</Link>
                  </td>
                  <td>{job.customer.name}</td>
                  <td>{job.branch.name}</td>
                  <td>{jobTypeNames[job.job_type]}</td>
                  <td>
                    <PriorityLabel priority={job.priority} />
                  </td>
                  <td>
                    <StatusLabel status={job.current_status} />
                  </td>
                  <td className="quantity-cell">
                    <time
                      dateTime={job.reported_at}
                      title={jobTime(job.reported_at)}
                    >
                      {jobAge(job.reported_at)}
                    </time>
                  </td>
                </tr>
              ))}
              {!data.items.length && (
                <tr>
                  <td colSpan={7}>
                    {data.total
                      ? 'No jobs on this page. Choose a previous page.'
                      : 'No jobs match these filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          <div className="inline-actions jobs-pagination">
            <Button
              variant="secondary"
              disabled={query.page === 1 || result.isFetching}
              onClick={() => update('page', String(query.page - 1))}
            >
              Previous
            </Button>
            <span>
              {data.total} jobs. Page {query.page} of {data.total_pages || 1}.
            </span>
            <Button
              variant="secondary"
              disabled={query.page >= data.total_pages || result.isFetching}
              onClick={() => update('page', String(query.page + 1))}
            >
              Next
            </Button>
            {query.page > data.total_pages && query.page > 1 && (
              <Button variant="secondary" onClick={() => update('page', '1')}>
                First page
              </Button>
            )}
          </div>
          <p className="text-secondary text-sm">
            Refreshes every 15 seconds while this page is visible.
          </p>
        </>
      )}
    </>
  );
}
