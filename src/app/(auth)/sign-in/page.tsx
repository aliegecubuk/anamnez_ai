'use client'

import { useSignIn, useUser, useClerk } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AuthShell from '@/components/auth/AuthShell'

// useSearchParams requires a Suspense boundary for static prerender —
// the default export at the bottom wraps this in one.
function SignInInner() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { isSignedIn, user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  const [step, setStep] = useState<'form' | '2fa'>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [twoFactorStrategy, setTwoFactorStrategy] = useState<'totp' | 'phone_code' | 'backup_code'>('totp')

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isLoading) return
    if (!isLoaded || !signIn) {
      setError('Yükleniyor, bir saniye sonra tekrar dene.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        // Push to '/'. Root page reads sessionStatus and dispatches:
        // active → /dashboard (or /superadmin), pending → /sign-in/tasks.
        router.push('/')
        router.refresh()
        return
      }
      if (result.status === 'needs_second_factor') {
        const factors = result.supportedSecondFactors ?? []
        // Diagnostic — share this output if account doesn't actually have 2FA enrolled.
        console.log('[sign-in] needs_second_factor', { supportedSecondFactors: factors })
        if (factors.length === 0) {
          setError(
            'Hesap 2FA istiyor ama enrolled factor yok. Clerk dashboard → Users → bu hesap → Multi-factor authentication kısmından kayıtlı factor\'leri kaldır, sonra tekrar dene.'
          )
          return
        }
        const totp = factors.find((f) => f.strategy === 'totp')
        const phone = factors.find((f) => f.strategy === 'phone_code')
        if (totp) {
          setTwoFactorStrategy('totp')
        } else if (phone) {
          setTwoFactorStrategy('phone_code')
          try {
            await signIn.prepareSecondFactor({ strategy: 'phone_code', phoneNumberId: phone.phoneNumberId })
          } catch (prepErr) {
            const { message } = parseClerkError(prepErr)
            setError(`SMS kodu gönderilemedi: ${message ?? 'bilinmiyor'}`)
            return
          }
        } else {
          setTwoFactorStrategy('backup_code')
        }
        setStep('2fa')
        return
      }
      if (result.status === 'needs_first_factor') {
        setError('Şifre girişi desteklenmiyor. Yöneticiyle iletişime geç.')
        return
      }
      setError(`Beklenmeyen durum: ${result.status}`)
    } catch (err: unknown) {
      const { code, message } = parseClerkError(err)
      if (code === 'form_identifier_not_found') {
        setError('Bu e-posta ile kayıtlı hesap yok. Önce kayıt olun.')
      } else if (code === 'form_password_incorrect') {
        setError('E-posta veya şifre hatalı.')
      } else if (code === 'too_many_requests') {
        setError('Çok fazla deneme. Bir kaç dakika bekleyin.')
      } else if (code === 'session_exists' || message?.toLowerCase().includes('already signed in')) {
        router.push('/')
        router.refresh()
        return
      } else {
        setError(message ?? code ?? 'Bilinmeyen hata.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault()
    if (isLoading) return
    if (!isLoaded || !signIn) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await signIn.attemptSecondFactor({ strategy: twoFactorStrategy, code })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.push('/')
        router.refresh()
        return
      }
      setError(`Beklenmeyen durum: ${result.status}`)
    } catch (err: unknown) {
      const { code: errCode, message } = parseClerkError(err)
      if (errCode === 'form_code_incorrect') {
        setError('Kod hatalı.')
      } else {
        setError(message ?? errCode ?? 'Bilinmeyen hata.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSwitch() {
    setIsLoading(true)
    try {
      await signOut()
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoaded && isSignedIn) {
    const currentEmail = user?.primaryEmailAddress?.emailAddress ?? user?.username ?? '—'
    return (
      <AuthShell heading="Zaten giriş yapmışsın." subheading="Devam et veya başka hesapla giriş yap.">
        <div className="space-y-5">
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Aktif hesap: </span>
            <span className="font-medium">{currentEmail}</span>
          </p>
          <Button
            onClick={() => { router.push('/'); router.refresh() }}
            disabled={isLoading}
            className="w-full h-11"
          >
            Devam Et
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSwitch}
            disabled={isLoading}
            className="w-full h-11"
          >
            {isLoading ? 'Çıkış yapılıyor...' : 'Başka hesapla giriş yap'}
          </Button>
        </div>
      </AuthShell>
    )
  }

  if (step === '2fa') {
    const subheading =
      twoFactorStrategy === 'totp'
        ? 'Authenticator uygulamandan 6 haneli kodu gir.'
        : twoFactorStrategy === 'phone_code'
        ? 'Telefonuna gönderilen 6 haneli kodu gir.'
        : 'Yedek kodlarından birini gir.'
    return (
      <AuthShell heading="Doğrulama gerekli." subheading={subheading}>
        <form onSubmit={handleVerify2FA} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="2fa-code" className="text-[12px] font-medium text-muted-foreground uppercase tracking-[0.14em]">
              {twoFactorStrategy === 'backup_code' ? 'Yedek kod' : 'Doğrulama kodu'}
            </Label>
            <Input
              id="2fa-code"
              type="text"
              inputMode={twoFactorStrategy === 'backup_code' ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(twoFactorStrategy === 'backup_code' ? e.target.value : e.target.value.replace(/\D/g, ''))}
              placeholder={twoFactorStrategy === 'backup_code' ? 'xxxx-xxxx' : '123456'}
              maxLength={twoFactorStrategy === 'backup_code' ? 16 : 6}
              disabled={isLoading}
              autoFocus
              className="h-12 font-mono tracking-[0.4em] text-center text-lg bg-card focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert" aria-live="polite">{error}</p>
          )}

          <Button type="submit" disabled={isLoading || code.length < (twoFactorStrategy === 'backup_code' ? 8 : 6)} className="w-full h-11 text-[15px]">
            {isLoading ? 'Doğrulanıyor...' : 'Doğrula ve Devam Et'}
          </Button>

          <button
            type="button"
            onClick={() => { setStep('form'); setCode(''); setError(null) }}
            disabled={isLoading}
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Geri dön
          </button>

          {twoFactorStrategy !== 'backup_code' && (
            <button
              type="button"
              onClick={() => { setTwoFactorStrategy('backup_code'); setCode(''); setError(null) }}
              disabled={isLoading}
              className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Yedek kod kullan
            </button>
          )}
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell heading="Tekrar hoş geldin." subheading="Hesabına giriş yap.">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {errorParam && (
          <p className="text-sm text-destructive" role="alert">
            {errorParam === 'lookup_failed'
              ? 'Sunucu hatası. Biraz sonra tekrar dene.'
              : 'Bir hata oluştu, tekrar dene.'}
          </p>
        )}

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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
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
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert" aria-live="polite">
            {error}
          </p>
        )}

        <Button type="submit" disabled={isLoading} className="w-full h-11 text-[15px]">
          {isLoading ? 'Giriş yapılıyor...' : !isLoaded ? 'Yükleniyor...' : 'Giriş Yap'}
        </Button>

        <div className="flex items-center justify-between pt-2 text-sm">
          <Link
            href="/sign-up"
            className="text-foreground hover:text-primary underline-offset-4 hover:underline transition-colors"
          >
            Hesap oluştur
          </Link>
          <Link
            href="/reset-password"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Şifremi unuttum
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  )
}
