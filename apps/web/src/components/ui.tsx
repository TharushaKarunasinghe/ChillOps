import { cloneElement, useId } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
  ReactElement,
  TableHTMLAttributes,
} from 'react';
import { statusNames } from '../design/contrast';
import type { JobStatus } from '../design/contrast';
import type { JobPriority } from '@chillops/shared/jobs';
import { priorityNames } from '../jobs/format';

export function PriorityLabel({ priority }: { priority: JobPriority }) {
  return (
    <span className={`priority-label priority-${priority}`}>
      {priorityNames[priority]}
    </span>
  );
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  'data-state'?: string;
}) {
  return (
    <button
      type={type}
      className={`button button-${variant} ${className}`}
      {...props}
    />
  );
}
export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`control ${className}`} {...props} />;
}
export function Select({
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`control ${className}`} {...props} />;
}
export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`control ${className}`} {...props} />;
}
export function Checkbox({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="checkbox-row">
      <input type="checkbox" className={`checkbox ${className}`} {...props} />
      <span>{label}</span>
    </label>
  );
}

type FieldControl = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};
export function FormField({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: ReactElement<FieldControl>;
}) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const description =
    [
      children.props['aria-describedby'],
      help ? `${id}-help` : '',
      error ? `${id}-error` : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-describedby': description,
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })}
      {help && (
        <p id={`${id}-help`} className="field-help">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function StatusLabel({ status }: { status: JobStatus }) {
  return (
    <span className={`status-label status-${status.replaceAll('_', '-')}`}>
      {statusNames[status]}
    </span>
  );
}
export function Table({
  caption,
  children,
  className = '',
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { caption: string }) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className={`data-table tabular-nums ${className}`} {...props}>
        <caption>{caption}</caption>
        {children}
      </table>
    </div>
  );
}
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="inline-actions">{actions}</div>}
    </header>
  );
}
