import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import tokensCss from '../styles/tokens.css?raw';
import {
  evaluateContrast,
  parseColors,
  statuses,
  statusNames,
} from '../design/contrast';
import {
  Button,
  Checkbox,
  FormField,
  Input,
  PageHeader,
  Select,
  StatusLabel,
  Table,
  Textarea,
} from '../components/ui';

const colors = parseColors(tokensCss);
const spacing = [...tokensCss.matchAll(/--space-(\d+):\s*([\d.]+)rem;/g)].map(
  (match) => ({ name: match[1]!, rem: Number(match[2]) }),
);
const jobs = [
  {
    id: 'JOB-1042',
    customer: 'Frostfern Markets',
    branch: 'Lantern Quay',
    status: 'unassigned',
    technicians: 'Not assigned',
    age: '00:18',
  },
  {
    id: 'JOB-1041',
    customer: 'Moonwell Picturehouse',
    branch: 'Copper Square',
    status: 'assigned',
    technicians: 'Mira Vale, Oren Finch',
    age: '00:42',
  },
  {
    id: 'JOB-1040',
    customer: 'Frostfern Markets',
    branch: 'Willow Arcade',
    status: 'in-transit',
    technicians: 'Tavi Reed, Nela Moss',
    age: '01:06',
  },
  {
    id: 'JOB-1039',
    customer: 'Cloudberry Grocers',
    branch: 'Pebble Junction',
    status: 'on-site',
    technicians: 'Oren Finch, Lio Wren',
    age: '01:34',
  },
  {
    id: 'JOB-1038',
    customer: 'Moonwell Picturehouse',
    branch: 'Fern Crossing',
    status: 'completed',
    technicians: 'Mira Vale, Nela Moss',
    age: '02:12',
  },
  {
    id: 'JOB-1037',
    customer: 'Cloudberry Grocers',
    branch: 'Lantern Quay',
    status: 'pending',
    technicians: 'Tavi Reed',
    age: '03:27',
  },
] as const;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

export function StyleguidePage() {
  const [notice, setNotice] = useState('No example action has been run.');
  return (
    <>
      <PageHeader
        title="Styleguide"
        description="Design tokens and native components for daily service operations. All sample records below are fictional."
        actions={<Link to="/">API health</Link>}
      />
      <div className="stack">
        <Section
          title="Color tokens"
          description="Exact base palette and semantic roles. Swatches are decorative; names and values sit on white. Silver and accent are not small text colors on light surfaces."
        >
          <div className="token-grid">
            {Object.entries(colors).map(([name, value]) => (
              <div key={name}>
                <div
                  className="token-swatch"
                  style={{ backgroundColor: value }}
                  aria-hidden="true"
                />
                <p className="token-name">--{name}</p>
                <p className="text-sm text-secondary font-mono">
                  {value.toUpperCase()}
                </p>
              </div>
            ))}
          </div>
        </Section>
        <Section
          title="Typography"
          description="IBM Plex Sans for the interface. IBM Plex Mono for job numbers, IDs, times and quantities. Latin normal weights only; self-hosted with font-display: swap."
        >
          <div className="sample-grid">
            {(['sans', 'mono'] as const).map((font) => (
              <div
                key={font}
                className={
                  font === 'sans' ? 'sample font-sans' : 'sample font-mono'
                }
              >
                <h3>IBM Plex {font === 'sans' ? 'Sans' : 'Mono'}</h3>
                {([400, 500, 600] as const).map((weight) => (
                  <p key={weight} style={{ fontWeight: weight }}>
                    Weight {weight}: Job JOB-1042 · 08:30 · 24 units
                  </p>
                ))}
              </div>
            ))}
          </div>
          <div className="sample mt-6">
            <p className="text-2xl font-semibold">Page title / 32px</p>
            <p className="text-xl font-semibold">App name / 24px</p>
            <p className="text-lg font-semibold">Section / 20px</p>
            <p className="text-base">Body / 16px</p>
            <p className="text-sm">Table and form / 14px</p>
            <p className="text-xs">Status and annotation / 12px</p>
          </div>
        </Section>
        <Section
          title="Spacing and structure"
          description="Approved spacing steps use a 4px base at the default root size. Radius is 4px, borders 1px. No arbitrary spacing utilities or default Tailwind palette. The dropdown shadow is reserved and not applied."
        >
          <div className="sample">
            {spacing.map(({ name, rem }) => (
              <div key={name} className="space-example">
                <code>
                  space-{name}: {rem * 16}px
                </code>
                <span
                  className="space-bar"
                  style={{ width: `var(--space-${name})` }}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-secondary">
            Sidebar: 256px. Navigation changes at 768px. Touch targets: at least
            44px high. Radius: 4px. Dropdown shadow: 0 4px 12px, navy at 12%.
          </p>
        </Section>
        <Section
          title="Buttons"
          description="Hover and pressed examples use the same tokens as live states. Color changes are immediate. Focus samples are shown persistently; every enabled button also has real keyboard focus. Disabled controls remain readable."
        >
          <div className="stack">
            {(['primary', 'secondary', 'danger'] as const).map((variant) => (
              <div key={variant} className="sample">
                <h3>{variant[0]!.toUpperCase() + variant.slice(1)}</h3>
                <div className="inline-actions">
                  {['default', 'hover', 'active', 'focus', 'disabled'].map(
                    (state) => (
                      <Button
                        key={state}
                        variant={variant}
                        data-state={state}
                        disabled={state === 'disabled'}
                        onClick={() =>
                          setNotice(`${variant} example activated.`)
                        }
                      >
                        {state === 'active'
                          ? 'Pressed'
                          : state[0]!.toUpperCase() + state.slice(1)}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-secondary" role="status">
            {notice}
          </p>
        </Section>
        <Section
          title="Form controls"
          description="Native input, select and textarea. Labels are linked to controls; help and error text are described by ID. Hover darkens the boundary to navy without a transition. Focus uses a dark outline with an offset."
        >
          <div className="sample-grid">
            <FormField
              label="Branch"
              help="Use the branch name on the job card."
            >
              <Input placeholder="Enter a fictional branch" />
            </FormField>
            <FormField label="Branch (focus sample)">
              <Input data-state="focus" defaultValue="Lantern Quay" />
            </FormField>
            <FormField
              label="Branch (disabled)"
              help="This example cannot be edited."
            >
              <Input disabled defaultValue="Willow Arcade" />
            </FormField>
            <FormField label="Branch (error)" error="Enter a branch name.">
              <Input defaultValue="" />
            </FormField>
            <FormField
              label="Job priority"
              help="Choose a priority for this example."
            >
              <Select defaultValue="routine">
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
              </Select>
            </FormField>
            <FormField label="Priority (focus sample)">
              <Select data-state="focus">
                <option>Routine</option>
                <option>Urgent</option>
              </Select>
            </FormField>
            <FormField label="Priority (disabled)">
              <Select disabled>
                <option>Routine</option>
              </Select>
            </FormField>
            <FormField label="Priority (error)" error="Select a priority.">
              <Select defaultValue="">
                <option value="">Select priority</option>
                <option value="routine">Routine</option>
              </Select>
            </FormField>
            <FormField
              label="Breakdown notes"
              help="Describe the equipment and the fault."
            >
              <Textarea placeholder="Example: Display case is not holding temperature." />
            </FormField>
            <FormField label="Notes (focus sample)">
              <Textarea
                data-state="focus"
                defaultValue="Check the display case controller."
              />
            </FormField>
            <FormField label="Notes (disabled)">
              <Textarea disabled defaultValue="This job card is closed." />
            </FormField>
            <FormField
              label="Notes (error)"
              error="Add a short description of the breakdown."
            >
              <Textarea />
            </FormField>
          </div>
          <div className="sample-grid mt-6">
            <div className="sample">
              <Checkbox label="Include stock used" />
              <Checkbox label="Include travel time (checked)" defaultChecked />
              <Checkbox label="Focus sample" data-state="focus" />
            </div>
            <div className="sample">
              <Checkbox label="Disabled checkbox" disabled />
              <Checkbox label="Disabled and checked" disabled defaultChecked />
              <Checkbox
                label="Confirm the example details"
                aria-invalid="true"
                aria-describedby="checkbox-error"
              />
              <p id="checkbox-error" className="field-error">
                Confirm the details before continuing.
              </p>
            </div>
          </div>
        </Section>
        <Section
          title="Keyboard focus and links"
          description="Use Tab and Shift+Tab to move through controls. On narrow screens, Menu opens navigation with Enter or Space; Escape closes it and returns focus. The ring sits on the surrounding surface, not on the button fill."
        >
          <div className="sample-grid">
            <div className="focus-surface bg-white">
              <Link to="/">Link on white</Link>
              <p className="mt-3 text-secondary text-sm">
                Hover and active: thicker underline. Focus: dark blue.
              </p>
            </div>
            <div className="focus-surface bg-ice">
              <Link to="/">Link on ice</Link>
              <p className="mt-3 text-secondary text-sm">
                Focus: dark blue, with 2px offset.
              </p>
            </div>
            <div className="focus-surface focus-surface-dark">
              <Link to="/">Link on navy</Link>
              <p className="mt-3 text-sm">Focus: accent, with 2px offset.</p>
            </div>
          </div>
        </Section>
        <Section
          title="Status labels"
          description="Every status includes text. Each tint is shown against white and ice. Tints are decorative and are never the sole way to identify a status. Labels are static, so hover, focus and disabled states do not apply."
        >
          <div className="sample-grid">
            {statuses.map((status) => (
              <div key={status} className="sample">
                <h3>{statusNames[status]}</h3>
                <div className="focus-surface bg-white">
                  <StatusLabel status={status} />
                  <span className="ml-3 text-sm text-secondary">On white</span>
                </div>
                <div className="focus-surface bg-ice">
                  <StatusLabel status={status} />
                  <span className="ml-3 text-sm text-secondary">On ice</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section
          title="Job table"
          description="Fictional records only. Sticky column headers, dense rows, 1px dividers and tabular numerals. Scroll horizontally on narrow screens. The scroll region is keyboard-focusable."
        >
          <Table caption="Sample breakdowns: all customers, branches and technicians are fictional.">
            <thead>
              <tr>
                {[
                  'Job number',
                  'Customer',
                  'Branch',
                  'Status',
                  'Assigned technicians',
                  'Age (hh:mm)',
                ].map((heading) => (
                  <th key={heading} scope="col">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="id-cell">{job.id}</td>
                  <td>{job.customer}</td>
                  <td>{job.branch}</td>
                  <td>
                    <StatusLabel status={job.status} />
                  </td>
                  <td>{job.technicians}</td>
                  <td className="quantity-cell">{job.age}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <h3 className="mt-6 mb-3">Empty state</h3>
          <Table caption="Empty table example">
            <thead>
              <tr>
                <th scope="col">Job number</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={2}>No breakdowns to display.</td>
              </tr>
            </tbody>
          </Table>
          <h3 className="mt-6 mb-3">Error state</h3>
          <p className="text-error-text bg-error-bg p-3 rounded-sm">
            Unable to load breakdowns. Try again.
          </p>
        </Section>
        <Section
          title="Page header"
          description="A plain title, supporting text and optional actions. The page header has no hover or disabled state; its actions use the standard button states."
        >
          <PageHeader
            title="Breakdowns"
            description="Review pending breakdowns and their current status."
            actions={
              <Button
                variant="secondary"
                onClick={() => setNotice('Page header action activated.')}
              >
                Example action
              </Button>
            }
          />
        </Section>
        <Section
          title="Contrast reference"
          description="Calculated from the same CSS tokens used above. Text target: 4.5:1. Focus and control boundaries: 3:1. Decorative tints, dividers and prohibited text pairings are marked informational."
        >
          <Table caption="Calculated contrast ratios">
            <thead>
              <tr>
                <th scope="col">Purpose</th>
                <th scope="col">Foreground / background</th>
                <th scope="col">Ratio</th>
                <th scope="col">Minimum</th>
              </tr>
            </thead>
            <tbody>
              {evaluateContrast(tokensCss).map((pair, index) => (
                <tr key={index}>
                  <td>{pair.purpose}</td>
                  <td>
                    <code>
                      {pair.foreground} / {pair.background}
                    </code>
                  </td>
                  <td className="quantity-cell">{pair.ratio.toFixed(2)}:1</td>
                  <td>
                    {pair.minimum ? `${pair.minimum}:1` : 'Informational'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      </div>
    </>
  );
}
