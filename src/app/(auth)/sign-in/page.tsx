'use client'

import { useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'

export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoaded) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      })

      if (result.status === 'complete') {
        await setActive!({ session: result.createdSessionId })
        router.push('/')
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ code: string }> }
      const code = clerkError?.errors?.[0]?.code

      if (code === 'form_identifier_not_found') {
        setError('Bu e-posta adresiyle kayıtlı hesap bulunamadı.')
      } else if (code === 'form_password_incorrect') {
        setError('E-posta veya şifre hatalı. Lütfen tekrar deneyin.')
      } else {
        setError('Bağlantı hatası. İnternet bağlantınızı kontrol edin.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-[400px] max-w-[calc(100%-2rem)] shadow-sm rounded-xl">
      <CardHeader className="pb-4">
        <h1 className="text-[28px] font-semibold leading-tight text-foreground">
          AnamnezAl
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Diş hekimi anamnez sistemi
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="font-semibold">
              E-posta
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ad@kurum.edu.tr"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="font-semibold">
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
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                style={{ minHeight: '44px' }}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              className="text-sm text-destructive"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !isLoaded}
          >
            {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center border-t-0 bg-transparent pt-0">
        <a
          href="/reset-password"
          className="text-sm text-primary hover:text-blue-700 transition-colors"
          tabIndex={0}
        >
          Şifremi unuttum
        </a>
      </CardFooter>
    </Card>
  )
}
