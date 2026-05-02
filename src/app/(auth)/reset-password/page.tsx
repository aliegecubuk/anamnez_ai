'use client'

import { useSignIn } from '@clerk/nextjs'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'

export default function ResetPasswordPage() {
  const { signIn, isLoaded } = useSignIn()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoaded) return

    setIsLoading(true)
    setError(null)

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      })
      setIsSent(true)
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ code: string }> }
      const code = clerkError?.errors?.[0]?.code
      if (code === 'form_identifier_not_found') {
        setError('Bu e-posta adresiyle kayıtlı hesap bulunamadı.')
      } else {
        setError('Bağlantı hatası. İnternet bağlantınızı kontrol edin.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isSent) {
    return (
      <Card className="w-[400px] max-w-[calc(100%-2rem)] shadow-sm rounded-xl">
        <CardHeader>
          <h1 className="text-[28px] font-semibold leading-tight text-foreground">
            AnamnezAl
          </h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">
            Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.
          </p>
        </CardContent>
        <CardFooter className="justify-center border-t-0 bg-transparent">
          <a
            href="/sign-in"
            className="text-sm text-primary hover:text-blue-700 transition-colors"
          >
            Giriş sayfasına dön
          </a>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-[400px] max-w-[calc(100%-2rem)] shadow-sm rounded-xl">
      <CardHeader>
        <h1 className="text-[28px] font-semibold leading-tight text-foreground">
          AnamnezAl
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Şifre sıfırlama
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="reset-email" className="font-semibold">
              E-posta
            </Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ad@kurum.edu.tr"
              disabled={isLoading}
            />
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
            {isLoading ? 'Gönderiliyor...' : 'Sıfırlama bağlantısı gönder'}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center border-t-0 bg-transparent pt-0">
        <a
          href="/sign-in"
          className="text-sm text-primary hover:text-blue-700 transition-colors"
        >
          Giriş sayfasına dön
        </a>
      </CardFooter>
    </Card>
  )
}
