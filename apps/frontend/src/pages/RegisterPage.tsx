import { useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { api, getApiErrorMessage } from '../lib/api';
import { authStore } from '../lib/auth-store';
import type { AuthResponse } from '../lib/types';

const PASSWORD_MIN_LENGTH = 8;
const NICKNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

function PasswordField({
  id,
  label,
  value,
  onChange,
  minLength,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  minLength: number;
  hint?: string;
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
          minLength={minLength}
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
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const navigate = useNavigate();
  const authState = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState);

  const registerMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<AuthResponse>('/auth/register', {
        email: email.trim(),
        nickname: nickname.trim(),
        password,
      });
      return response.data;
    },
    onSuccess: (data) => {
      authStore.setTokens(data.accessToken, data.accessTokenExpiresIn);
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => {
      const message = getApiErrorMessage(error);
      if (/validation failed/i.test(message)) {
        setLocalError('Enter a valid email address, for example name@example.com.');
        return;
      }
      setLocalError(message);
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    const trimmedEmail = email.trim();
    const trimmedNickname = nickname.trim();

    if (!trimmedEmail) {
      setLocalError('Email is required.');
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setLocalError('Enter a valid email address, for example name@example.com.');
      return;
    }

    if (trimmedNickname.length < 3 || trimmedNickname.length > 24) {
      setLocalError('Nickname must be 3 to 24 characters long.');
      return;
    }

    if (!NICKNAME_PATTERN.test(trimmedNickname)) {
      setLocalError('Nickname can contain only letters, numbers, and underscore.');
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setLocalError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    registerMutation.mutate();
  };

  if (authState.accessToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Register</CardTitle>
        <CardDescription>Create an account to save cities, alerts, and guides access.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="register-email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="register-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="register-nickname" className="text-sm font-medium">
              Nickname
            </label>
            <Input
              id="register-nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              type="text"
              minLength={3}
              maxLength={24}
              required
            />
            <p className="text-xs text-muted-foreground">Use 3 to 24 characters. Allowed: letters, numbers, underscore.</p>
          </div>

          <PasswordField
            id="register-password"
            label="Password"
            value={password}
            onChange={setPassword}
            minLength={PASSWORD_MIN_LENGTH}
            hint="Use at least 8 characters. Any standard characters are allowed."
          />

          <PasswordField
            id="register-confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            minLength={PASSWORD_MIN_LENGTH}
          />

          <Button type="submit" disabled={registerMutation.isPending} className="w-full">
            {registerMutation.isPending ? 'Registering...' : 'Register'}
          </Button>

          {localError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {localError}
            </p>
          ) : null}

          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
