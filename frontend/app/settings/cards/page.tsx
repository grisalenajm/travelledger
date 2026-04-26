"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  useLoyaltyCards,
  useCreateLoyaltyCard,
  useDeleteLoyaltyCard,
} from "@/hooks/use-loyalty-cards"
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { ProgramType } from "@/types"

const PROGRAM_TYPE_CONFIG: Record<ProgramType, { label: string; emoji: string }> = {
  airline: { label: "Aerolínea", emoji: "✈️" },
  train: { label: "Tren", emoji: "🚂" },
  hotel: { label: "Hotel", emoji: "🏨" },
  car_rental: { label: "Coche", emoji: "🚗" },
  other: { label: "Otro", emoji: "🎫" },
}

const INPUT_CLASS =
  "mt-1 block w-full rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"

const schema = z.object({
  program_name: z.string().min(1, "Campo obligatorio"),
  program_type: z.enum(["airline", "train", "hotel", "car_rental", "other"]),
  membership_number: z.string().min(1, "Campo obligatorio"),
  tier: z.string().optional(),
  alias: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function CardsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const { data: cards, isLoading } = useLoyaltyCards()
  const createCard = useCreateLoyaltyCard()
  const deleteCard = useDeleteLoyaltyCard()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      program_name: "",
      program_type: "airline",
      membership_number: "",
      tier: "",
      alias: "",
    },
    mode: "onChange",
  })

  function openModal() {
    reset()
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    reset()
  }

  const onSubmit = async (values: FormValues) => {
    await createCard.mutateAsync({
      program_name: values.program_name,
      program_type: values.program_type,
      membership_number: values.membership_number,
      tier: values.tier || null,
      alias: values.alias || null,
    })
    closeModal()
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            Tarjetas de viajero
          </h1>
          <Button size="md" onClick={openModal}>
            <span className="material-symbols-outlined text-sm mr-1.5">add</span>
            Añadir tarjeta
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-surface-container-lowest animate-pulse" />
            ))}
          </div>
        ) : !cards || cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-5xl mb-4 select-none" aria-hidden="true">🎫</span>
            <p className="font-headline text-base font-semibold text-on-surface">
              Sin tarjetas de viajero
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Añade tus programas de puntos para vincularlos a tus gastos.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => {
              const { label, emoji } = PROGRAM_TYPE_CONFIG[card.program_type]
              return (
                <div
                  key={card.id}
                  className="flex items-center gap-4 rounded-xl bg-surface-container-lowest px-5 py-4 shadow-editorial"
                >
                  <span className="text-2xl leading-none select-none" aria-hidden="true">
                    {emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-on-surface truncate">
                      {card.alias ?? card.program_name}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {card.membership_number}
                      {card.tier ? ` · ${card.tier}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-on-surface-variant/70">{label}</p>
                  </div>
                  <button
                    onClick={() => deleteCard.mutate(card.id)}
                    disabled={deleteCard.isPending}
                    className="shrink-0 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error disabled:opacity-40"
                    aria-label={`Eliminar ${card.alias ?? card.program_name}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onClose={closeModal} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir tarjeta de viajero</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <Label htmlFor="program_name">Programa *</Label>
            <input
              id="program_name"
              type="text"
              placeholder="Ej: Iberia Plus"
              className={INPUT_CLASS}
              {...register("program_name")}
            />
            {errors.program_name && (
              <p className="mt-1 text-xs text-error">{errors.program_name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="program_type">Tipo *</Label>
            <select id="program_type" className={INPUT_CLASS} {...register("program_type")}>
              {Object.entries(PROGRAM_TYPE_CONFIG).map(([value, { label, emoji }]) => (
                <option key={value} value={value}>
                  {emoji} {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="membership_number">Número de socio *</Label>
            <input
              id="membership_number"
              type="text"
              placeholder="Ej: IBE-123456789"
              className={INPUT_CLASS}
              {...register("membership_number")}
            />
            {errors.membership_number && (
              <p className="mt-1 text-xs text-error">{errors.membership_number.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="tier">Nivel</Label>
            <input
              id="tier"
              type="text"
              placeholder="Ej: Silver, Gold, Platinum"
              className={INPUT_CLASS}
              {...register("tier")}
            />
          </div>

          <div>
            <Label htmlFor="alias">Alias</Label>
            <input
              id="alias"
              type="text"
              placeholder="Ej: Iberia personal"
              className={INPUT_CLASS}
              {...register("alias")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || createCard.isPending}>
              {createCard.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </main>
  )
}
