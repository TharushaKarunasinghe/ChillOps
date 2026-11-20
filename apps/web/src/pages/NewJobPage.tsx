import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  createJobSchema,
  JOB_PRIORITIES,
  JOB_TYPES,
} from '@chillops/shared/jobs';
import {
  Button,
  FormField,
  PageHeader,
  Select,
  Textarea,
} from '../components/ui';
import {
  useCustomers,
  useBranches,
  useEquipment,
  useCreateJob,
} from '../jobs/queries';
import { JobsApiError } from '../jobs/api';
import { jobTypeNames, priorityNames } from '../jobs/format';

export function NewJobPage() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(''),
    [branch, setBranch] = useState(''),
    [equipment, setEquipment] = useState('');
  const [type, setType] = useState('breakdown'),
    [priority, setPriority] = useState('routine'),
    [description, setDescription] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const customers = useCustomers(),
    branches = useBranches(customer),
    items = useEquipment(branch),
    create = useCreateJob();
  const submitting = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    create.reset();
    setFields({});
    const parsed = createJobSchema.safeParse({
      customer_id: customer,
      branch_id: branch,
      equipment_id: equipment || null,
      job_type: type,
      priority,
      description,
    });
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues)
        (errors[String(issue.path[0])] ??= []).push(issue.message);
      setFields(errors);
      return;
    }
    submitting.current = true;
    try {
      const result = await create.mutateAsync(parsed.data);
      navigate(`/jobs/${result.job.id}`);
    } catch (error) {
      if (error instanceof JobsApiError) setFields(error.fields ?? {});
    } finally {
      submitting.current = false;
    }
  }
  const lookupError = customers.error || branches.error || items.error;
  return (
    <>
      <Link to="/jobs">Back to jobs</Link>
      <PageHeader
        title="New job"
        description="Create a manual job. Its initial status will be Unassigned."
      />
      {lookupError && (
        <div role="alert" className="error-panel">
          <p>{lookupError.message}</p>
          <Button
            variant="secondary"
            onClick={() => {
              if (customers.error) void customers.refetch();
              if (branches.error) void branches.refetch();
              if (items.error) void items.refetch();
            }}
          >
            Retry choices
          </Button>
        </div>
      )}
      <form
        className="panel stack job-form"
        onSubmit={(event) => void submit(event)}
        noValidate
        aria-busy={create.isPending}
      >
        <FormField label="Customer" error={fields.customer_id?.[0]}>
          <Select
            required
            value={customer}
            disabled={
              create.isPending || customers.isPending || !!customers.error
            }
            onChange={(e) => {
              setCustomer(e.target.value);
              setBranch('');
              setEquipment('');
              setFields({});
            }}
          >
            <option value="">
              {customers.isPending ? 'Loading customers...' : 'Select customer'}
            </option>
            {customers.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Branch" error={fields.branch_id?.[0]}>
          <Select
            required
            value={branch}
            disabled={
              create.isPending ||
              !customer ||
              branches.isPending ||
              !!branches.error
            }
            onChange={(e) => {
              setBranch(e.target.value);
              setEquipment('');
              setFields({});
            }}
          >
            <option value="">
              {customer && branches.isPending
                ? 'Loading branches...'
                : 'Select branch'}
            </option>
            {branches.data?.items.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Equipment (optional)"
          error={fields.equipment_id?.[0]}
        >
          <Select
            value={equipment}
            disabled={
              create.isPending || !branch || items.isPending || !!items.error
            }
            onChange={(e) => setEquipment(e.target.value)}
          >
            <option value="">
              {branch && items.isPending
                ? 'Loading equipment...'
                : 'Not specified'}
            </option>
            {items.data?.items.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Type" error={fields.job_type?.[0]}>
          <Select
            value={type}
            disabled={create.isPending}
            onChange={(e) => setType(e.target.value)}
          >
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {jobTypeNames[t]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Priority" error={fields.priority?.[0]}>
          <Select
            value={priority}
            disabled={create.isPending}
            onChange={(e) => setPriority(e.target.value)}
          >
            {JOB_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {priorityNames[p]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Description"
          help="Describe the fault or planned service. Maximum 4,000 characters."
          error={fields.description?.[0]}
        >
          <Textarea
            required
            maxLength={4000}
            value={description}
            disabled={create.isPending}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
        {Object.keys(fields).length > 0 && (
          <p role="alert" className="field-error">
            Check the highlighted fields.
          </p>
        )}
        {create.error && (
          <p role="alert" className="field-error">
            {create.error.message}
          </p>
        )}
        <div className="inline-actions">
          <Button
            type="submit"
            disabled={
              create.isPending ||
              !!lookupError ||
              !customer ||
              !branch ||
              branches.isPending ||
              items.isPending
            }
          >
            {create.isPending ? 'Creating job...' : 'Create job'}
          </Button>
          <Link to="/jobs">Cancel</Link>
        </div>
      </form>
    </>
  );
}
