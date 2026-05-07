'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PatientListItem } from '@/lib/patients/types'

const schema = z.object({
  full_name: z.string().trim().min(1, 'Ad soyad zorunludur.').max(100),
  tc_kimlik_no: z
    .string()
    .trim()
    .min(1, 'TC kimlik numarası zorunludur.')
    .regex(/^[0-9]+$/, 'TC kimlik numarası yalnızca rakam içermelidir.')
    .length(11, 'TC kimlik numarası tam 11 haneli olmalıdır.'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (patient: PatientListItem) => void
}

export default function CreatePatientDialog({ open, onOpenChange, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const tcValue = watch('tc_kimlik_no') ?? ''

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    if (res.ok) {
      const patient: PatientListItem = await res.json()
      onSuccess(patient)
      reset()
      onOpenChange(false)
    } else {
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) {
        setServerError(body.error ?? 'Bu TC kimlik numarasıyla kayıtlı bir hasta zaten var.')
      } else {
        toast.error('Hasta oluşturulamadı. Lütfen tekrar deneyin.')
      }
    }
  }

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      reset()
      setServerError(null)
    }
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Yeni Hasta Oluştur</DialogTitle>
          <DialogDescription>
            Hasta kaydı oluşturmak için ad soyad ve TC kimlik numarasını girin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Ad Soyad</Label>
            <Input
              id="full_name"
              placeholder="Örn: Ayşe Kaya"
              maxLength={100}
              {...register('full_name')}
            />
            {errors.full_name && (
              <p className="text-sm text-destructive">{errors.full_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tc_kimlik_no">TC Kimlik No</Label>
            <Input
              id="tc_kimlik_no"
              type="text"
              inputMode="numeric"
              placeholder="11 haneli TC kimlik numarası"
              maxLength={11}
              pattern="[0-9]{11}"
              className="font-mono"
              {...register('tc_kimlik_no')}
            />
            <p className="text-sm text-muted-foreground text-right">{tcValue.length}/11</p>
            {errors.tc_kimlik_no && (
              <p className="text-sm text-destructive">{errors.tc_kimlik_no.message}</p>
            )}
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                'Oluştur'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
