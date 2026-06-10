'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus } from 'lucide-react'
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
import { VALID_DEPARTMENTS } from '@/lib/templates/types'
import { DEPARTMENT_LABELS } from './TemplateList'

const schema = z.object({
  name: z.string().trim().min(1, 'Şablon adı zorunludur.').max(120),
  department: z.enum(VALID_DEPARTMENTS as [string, ...string[]], {
    message: 'Geçersiz bölüm.',
  }),
})

type FormValues = z.infer<typeof schema>

export default function CreateTemplateDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { department: 'genel' },
  })

  const onSubmit = async (values: FormValues) => {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    if (res.ok) {
      toast.success('Şablon oluşturuldu.')
      reset()
      setOpen(false)
      router.refresh()
    } else {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Şablon oluşturulamadı. Lütfen tekrar deneyin.')
    }
  }

  const handleOpenChange = (val: boolean) => {
    if (!val) reset()
    setOpen(val)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="h-11 shrink-0 gap-2">
        <Plus className="h-4 w-4" />
        Yeni Şablon
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Yeni Şablon Oluştur</DialogTitle>
            <DialogDescription>
              Şablon adını girin ve bağlı olduğu bölümü seçin.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Şablon Adı</Label>
              <Input
                id="template-name"
                placeholder="Örn: Periodontoloji Anamnez Formu"
                maxLength={120}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-department">Bölüm</Label>
              <select
                id="template-department"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                {...register('department')}
              >
                {VALID_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTMENT_LABELS[d]}
                  </option>
                ))}
              </select>
              {errors.department && (
                <p className="text-sm text-destructive">{errors.department.message}</p>
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
    </>
  )
}
