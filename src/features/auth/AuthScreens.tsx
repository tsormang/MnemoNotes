import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, LogOut, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { invokeEdgeFunction } from '../../lib/edge-functions'
import { resolvePostLoginPath } from '../../lib/auth-routing'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import {
  acceptInviteSchema,
  loginSchema,
  type AcceptInviteInput,
  type LoginInput,
} from '../../lib/validation'
import { useAuth } from './AuthProvider'

export function LoginScreen() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)

    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (signInError) {
      setError(signInError.message)
      return
    }

    navigate(await resolvePostLoginPath())
  })

  return (
    <AuthFrame
      title="Login"
      subtitle="Owners and personnel sign in to their pharmacy workspace."
      icon={<KeyRound size={22} aria-hidden="true" />}
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" autoComplete="email" placeholder="you@pharmacy.com" {...form.register('email')} />
          <FieldError message={form.formState.errors.email?.message} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            {...form.register('password')}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </label>
        {error ? <p className="field-error">{error}</p> : null}
        <button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <SupabaseNotice />
    </AuthFrame>
  )
}

export function AcceptInviteScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  const defaultToken = useMemo(() => searchParams.get('token') ?? '', [searchParams])

  const form = useForm<AcceptInviteInput>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      token: defaultToken,
      password: '',
      fullName: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)

    try {
      await invokeEdgeFunction<{ userId: string }>(
        'accept-invite',
        {
          token: values.token,
          password: values.password,
          fullName: values.fullName,
        },
        { requireAuth: false },
      )
      navigate('/login')
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Could not accept invite.')
    }
  })

  return (
    <AuthFrame
      title="Accept invite"
      subtitle="Owners and personnel join a pharmacy workspace by invitation."
      icon={<UserPlus size={22} aria-hidden="true" />}
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          Invite token
          <input type="text" placeholder="Paste invite token" {...form.register('token')} />
          <FieldError message={form.formState.errors.token?.message} />
        </label>
        <label>
          Full name
          <input type="text" placeholder="Your display name" {...form.register('fullName')} />
          <FieldError message={form.formState.errors.fullName?.message} />
        </label>
        <label>
          Password
          <input type="password" placeholder="Minimum 10 characters" {...form.register('password')} />
          <FieldError message={form.formState.errors.password?.message} />
        </label>
        {error ? <p className="field-error">{error}</p> : null}
        <button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Creating account…' : 'Accept invite'}
        </button>
      </form>
      <div className="invite-card">
        <Mail size={24} aria-hidden="true" />
        <p>Invite links are issued by platform admins and workspace owners through trusted Edge Functions.</p>
      </div>
      <SupabaseNotice />
    </AuthFrame>
  )
}

function AuthFrame({
  children,
  icon,
  subtitle,
  title,
}: {
  children: ReactNode
  icon: ReactNode
  subtitle: string
  title: string
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-icon">{icon}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
    </main>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error">{message}</span> : null
}

function SupabaseNotice() {
  return (
    <div className="supabase-notice">
      <ShieldCheck size={18} aria-hidden="true" />
      {isSupabaseConfigured
        ? 'Supabase environment detected.'
        : 'Add Supabase environment values to enable live authentication.'}
    </div>
  )
}


export function SignOutButton() {
  const { signOut } = useAuth()

  if (!isSupabaseConfigured) {
    return null
  }

  return (
    <button className="icon-ghost" type="button" aria-label="Sign out" onClick={() => void signOut()}>
      <LogOut size={19} aria-hidden="true" />
    </button>
  )
}
