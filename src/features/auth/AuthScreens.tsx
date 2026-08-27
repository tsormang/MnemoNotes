import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, KeyRound, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  ownerRegistrationSchema,
  type OwnerRegistrationInput,
} from '../../lib/validation'

export function LoginScreen() {
  return (
    <AuthFrame
      title="Login"
      subtitle="Owners and personnel sign in to their pharmacy workspace."
      icon={<KeyRound size={22} aria-hidden="true" />}
    >
      <form className="auth-form">
        <label>
          Email
          <input type="email" autoComplete="email" placeholder="you@pharmacy.com" />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" placeholder="Your password" />
        </label>
        <button type="button">Sign in</button>
      </form>
      <SupabaseNotice />
    </AuthFrame>
  )
}

export function OwnerRegisterScreen() {
  const form = useForm<OwnerRegistrationInput>({
    resolver: zodResolver(ownerRegistrationSchema),
    defaultValues: {
      pharmacyName: '',
      ownerName: '',
      email: '',
      password: '',
    },
  })

  return (
    <AuthFrame
      title="Register pharmacy"
      subtitle="Create the first Owner account and pharmacy workspace."
      icon={<Building2 size={22} aria-hidden="true" />}
    >
      <form className="auth-form" onSubmit={form.handleSubmit(() => undefined)}>
        <label>
          Pharmacy name
          <input {...form.register('pharmacyName')} placeholder="Central Pharmacy" />
          <FieldError message={form.formState.errors.pharmacyName?.message} />
        </label>
        <label>
          Owner name
          <input {...form.register('ownerName')} placeholder="Maria Antoniou" />
          <FieldError message={form.formState.errors.ownerName?.message} />
        </label>
        <label>
          Email
          <input {...form.register('email')} type="email" placeholder="owner@pharmacy.com" />
          <FieldError message={form.formState.errors.email?.message} />
        </label>
        <label>
          Password
          <input {...form.register('password')} type="password" placeholder="Minimum 10 characters" />
          <FieldError message={form.formState.errors.password?.message} />
        </label>
        <button type="submit">Create owner workspace</button>
      </form>
      <SupabaseNotice />
    </AuthFrame>
  )
}

export function AcceptInviteScreen() {
  return (
    <AuthFrame
      title="Accept invite"
      subtitle="Personnel join an existing pharmacy by invitation."
      icon={<UserPlus size={22} aria-hidden="true" />}
    >
      <div className="invite-card">
        <Mail size={24} aria-hidden="true" />
        <p>Invite links will be issued by a trusted Edge Function using Supabase Auth Admin.</p>
      </div>
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
