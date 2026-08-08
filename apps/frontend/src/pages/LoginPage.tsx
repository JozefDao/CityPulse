import { useMemo, useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { api, getApiErrorMessage } from '../lib/api';
import { authStore } from '../lib/auth-store';
import type { AuthResponse } from '../lib/types';

type LocationState = {
  from?: {
    pathname?: string;
  };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

function PasswordField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? 'text' : 'password'}
          required
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const navigate = useNavigate();
  const authState = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState);
  const location = useLocation();
  const from = (location.state as LocationState | undefined)?.from?.pathname ?? '/dashboard';

  const emailError = useMemo(() => {
    if (!email.trim()) {
      return 'Email is required.';
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      return 'Enter a valid email address, for example name@example.com.';
    }

    return null;
  }, [email]);

  const passwordError = useMemo(() => {
    if (!password) {
      return 'Password is required.';
    }

    return null;
  }, [password]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<AuthResponse>('/auth/login', { email: email.trim(), password });
      return response.data;
    },
    onSuccess: (data) => {
      setLocalError(null);
      authStore.setTokens(data.accessToken, data.accessTokenExpiresIn);
      navigate(from, { replace: true });
    },
  });

  const remoteErrorMessage = loginMutation.isError ? getApiErrorMessage(loginMutation.error) : null;
  const loginErrorMessage = localError ?? (
    remoteErrorMessage
      ? /validation failed/i.test(remoteErrorMessage)
        ? 'Enter a valid email address, for example name@example.com.'
        : /credential|unauthorized|invalid/i.test(remoteErrorMessage)
          ? 'Invalid email or password.'
          : remoteErrorMessage
      : null
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (emailError) {
      setLocalError(emailError);
      return;
    }

    if (passwordError) {
      setLocalError(passwordError);
      return;
    }

    setLocalError(null);
    loginMutation.mutate();
  };

  if (authState.accessToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Login to access your dashboard and watchlist.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (localError) setLocalError(null);
              }}
              type="email"
              required
            />
          </div>
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              if (localError) setLocalError(null);
            }}
          />
          <Button type="submit" disabled={loginMutation.isPending} className="w-full">
            {loginMutation.isPending ? 'Logging in...' : 'Login'}
          </Button>
          {loginErrorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {loginErrorMessage}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            No account yet?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Register
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
