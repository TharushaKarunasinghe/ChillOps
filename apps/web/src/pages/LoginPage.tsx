import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { loginSchema } from '@chillops/shared/auth';
import { useAuth } from '../auth/AuthContext';
import { Button, FormField, Input, PageHeader } from '../components/ui';

export function LoginPage() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (auth.user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError('Email or password is incorrect');
      return;
    }
    setBusy(true);
    try {
      await auth.login(parsed.data.email, parsed.data.password);
      setPassword('');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Unable to log in. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Log in"
        description="Use your ChillOps account to access service operations."
      />
      <form
        className="panel stack login-form"
        onSubmit={(event) => void submit(event)}
        noValidate
        aria-busy={busy}
      >
        <FormField label="Email">
          <Input
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            required
          />
        </FormField>
        <FormField label="Password" help="12 to 128 characters.">
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            required
          />
        </FormField>
        {(error || auth.error) && (
          <p className="field-error" role="alert">
            {error || auth.error}
          </p>
        )}
        <div>
          <Button type="submit" disabled={busy || auth.loading}>
            {busy ? 'Logging in...' : 'Log in'}
          </Button>
        </div>
      </form>
    </>
  );
}
