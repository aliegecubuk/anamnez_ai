'use client'

import { useSignUp } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AuthShell from '@/components/auth/AuthShell'

export default function SignUpPage() {
  const { signUp, setActive, isLoaded } = useSignUp()
  const router = useRouter()

  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function parseClerkError(err: unknown): { code: string | undefined; message: string | undefined } {
    const e = err as {
      errors?: Array<{ code?: string; message?: string }>
      message?: string
      code?: string
    }
    return {
      code: e?.errors?.[0]?.code ?? e?.code,
      message: e?.errors?.[0]?.message ?? e?.message,
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (isLoading) return
    if (!isLoaded || !signUp) {
      setError('Yükleniyor, bir saniye sonra tekrar dene.')
      return
    }
    setIsLoading(true)
    setError(null)

    try {
      const result = await signUp.create({ emailAddress: email, password })

      if (result.status === 'complete') {
        setSuccess(true)
        try {
          await setActive({ session: result.createdSessionId })
          // Full reload: guarantees the fresh session cookie is seen by the
          // server on the next request (router.push can race Clerk's cookie).
          window.location.assign('/')
        } catch {
          // Account exists in Clerk even if session activation failed —
          // send the user to sign-in instead of leaving them stranded.
          router.push('/sign-in')
        }
        return
      }

      if (result.status === 'missing_requirements') {
        try {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
          setStep('verify')
          return
        } catch (prepErr) {
          const { message } = parseClerkError(prepErr)
          setError(`Doğrulama başlatılamadı: ${message ?? 'bilinmiyor'}`)
          return
        }
      }
      setError(`Beklenmeyen durum: ${result.status}`)
    } catch (err: unknown) {
      const { code, message } = parseClerkError(err)
      if (code === 'session_exists') {
        // Already signed in (e.g. double submit) — just go in.
        window.location.assign('/')
        return
      }
      if (code === 'form_identifier_exists') {
        setError('Bu e-posta zaten kayıtlı. Giriş yapmayı dene.')
      } else if (code === 'form_password_pwned') {
        setError('Bu şifre veri ihlallerinde tespit edildi. Başka bir şifre seç.')
      } else if (code === 'form_password_length_too_short') {
        setError('Şifre en az 8 karakter olmalı.')
      } else {
        setError(message ?? code ?? 'Bilinmeyen hata.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (isLoading) return
    if (!isLoaded || !signUp) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await signUp.attemptEmailAddressVerification({ code })
      if (result.status === 'complete') {
        setSuccess(true)
        try {
          await setActive({ session: result.createdSessionId })
          window.location.assign('/')
        } catch {
          router.push('/sign-in')
        }
        return
      }
      setError(`Beklenmeyen durum: ${result.status}`)
    } catch (err: unknown) {
      const { code: errCode, message } = parseClerkError(err)
      if (errCode === 'form_code_incorrect') {
        setError('Doğrulama kodu hatalı.')
      } else {
        setError(message ?? errCode ?? 'Bilinmeyen hata.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'verify') {
    return (
      <AuthShell heading="Bir kod gönderdik." subheading={`${email} adresine 6 haneli doğrulama kodu yolladık.`}>
        <form onSubmit={handleVerify} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="code" className="text-[12px] font-medium text-muted-foreground uppercase tracking-[0.14em]">
              Doğrulama kodu
            </Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              maxLength={6}
              disabled={isLoading}
              autoFocus
              className="h-12 font-mono tracking-[0.4em] text-center text-lg bg-card focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert" aria-live="polite">{error}</p>
          )}

          <Button type="submit" disabled={isLoading || success || code.length < 6} className="w-full h-11 text-[15px]">
            {success ? 'Doğrulandı, yönlendiriliyorsun…' : isLoading ? 'Doğrulanıyor...' : 'Doğrula ve Devam Et'}
          </Button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell heading="Hadi başlayalım." subheading="Yeni hesap oluştur, saniyeler içinde başla.">
      <form onSubmit={handleSignUp} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[12px] font-medium text-muted-foreground uppercase tracking-[0.14em]">
            E-posta
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ad@ornek.com"
            disabled={isLoading}
            className="h-11 bg-card border-border focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-[12px] font-medium text-muted-foreground uppercase tracking-[0.14em]">
            Şifre
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              minLength={8}
              className="h-11 pr-11 bg-card border-border focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground transition-colors rounded-md"
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">En az 8 karakter.</p>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert" aria-live="polite">{error}</p>
        )}

        <Button type="submit" disabled={isLoading || success} className="w-full h-11 text-[15px]">
          {success ? 'Hesap oluşturuldu, yönlendiriliyorsun…' : isLoading ? 'Hesap oluşturuluyor...' : !isLoaded ? 'Yükleniyor...' : 'Hesap Oluştur'}
        </Button>
        <div id="clerk-captcha" />

        <p className="pt-2 text-sm text-muted-foreground">
          Hesabın var mı?{' '}
          <Link href="/sign-in" className="text-foreground hover:text-primary underline-offset-4 hover:underline transition-colors">
            Giriş yap
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
