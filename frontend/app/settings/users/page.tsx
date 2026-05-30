"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useIsAdmin } from "@/hooks/use-role"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api"

function extractMsg(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const body = JSON.parse(err.message) as { detail?: string }
      return body.detail ?? err.message
    } catch {
      return err.message
    }
  }
  return (err as Error).message ?? "Error desconocido"
}

interface ManagedUser {
  id: string
  email: string
  name: string
  is_admin: boolean
  is_guest: boolean
  is_active: boolean
  must_change_password: boolean
  has_pending_invite: boolean
  invited_by: string | null
  created_at: string
}

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(1, "El nombre es obligatorio"),
  is_admin: z.boolean(),
})

type InviteValues = z.infer<typeof inviteSchema>

const labelClass =
  "font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant"
const inputClass =
  "w-full bg-transparent border-b border-outline py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none transition-colors font-body text-sm"
const errorClass = "text-error text-xs font-body mt-1"

function roleLabel(user: ManagedUser): string {
  if (user.is_guest) return "Guest"
  if (user.is_admin) return "Admin"
  return "Usuario"
}

function statusBadge(user: ManagedUser) {
  if (!user.is_active && user.has_pending_invite) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wide">
        <span className="material-symbols-outlined text-[12px]">schedule</span>
        Pendiente
      </span>
    )
  }
  if (!user.is_active) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-error-container text-error uppercase tracking-wide">
        <span className="material-symbols-outlined text-[12px]">block</span>
        Inactivo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800 uppercase tracking-wide">
      <span className="material-symbols-outlined text-[12px]">check_circle</span>
      Activo
    </span>
  )
}

export default function UsersSettingsPage() {
  const isAdmin = useIsAdmin()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) router.replace("/settings")
  }, [isAdmin, router])

  const { data: users = [], isLoading } = useQuery<ManagedUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => api.get<ManagedUser[]>("/api/proxy/users"),
    enabled: isAdmin,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", name: "", is_admin: false },
  })

  const inviteMutation = useMutation({
    mutationFn: (data: InviteValues) =>
      api.post<ManagedUser>("/api/proxy/users/invite", data),
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      reset()
      setInviteSuccess(`Invitación enviada a ${newUser.email}`)
      setTimeout(() => setInviteSuccess(null), 5000)
    },
    onError: (err: unknown) => {
      setError("root", { message: extractMsg(err) })
    },
  })

  async function handleResend(userId: string) {
    setActionError(null)
    try {
      await api.post(`/api/proxy/users/${userId}/resend-invite`, {})
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    } catch (err) {
      setActionError(extractMsg(err))
    }
  }

  async function handleToggle(userId: string) {
    setActionError(null)
    try {
      await api.put(`/api/proxy/users/${userId}/toggle`, {})
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    } catch (err) {
      setActionError(extractMsg(err))
    }
  }

  async function handleRoleChange(userId: string, makeAdmin: boolean) {
    setActionError(null)
    try {
      await api.put(`/api/proxy/users/${userId}/role`, { is_admin: makeAdmin })
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    } catch (err) {
      setActionError(extractMsg(err))
    }
  }

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`¿Eliminar a "${name}" de forma permanente? Esta acción no se puede deshacer.`)) return
    setActionError(null)
    try {
      await api.delete(`/api/proxy/users/${userId}`)
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    } catch (err) {
      setActionError(extractMsg(err))
    }
  }

  if (!isAdmin) return null

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-12">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Volver"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div>
            <h1 className="font-headline text-2xl font-bold text-on-surface">
              Gestión de usuarios
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Solo visible para administradores
            </p>
          </div>
        </div>

        {/* ── Formulario de invitación ── */}
        <section className="space-y-6">
          <h2 className="font-headline text-xl font-bold text-on-surface">
            Invitar usuario
          </h2>

          <form
            onSubmit={handleSubmit((data) => inviteMutation.mutate(data))}
            className="space-y-6 bg-surface-container-lowest rounded-2xl p-6 shadow-editorial"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className={labelClass}>Email</label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="usuario@empresa.com"
                  className={inputClass}
                />
                {errors.email && <p className={errorClass}>{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Nombre</label>
                <input
                  {...register("name")}
                  placeholder="Nombre completo"
                  className={inputClass}
                />
                {errors.name && <p className={errorClass}>{errors.name.message}</p>}
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer w-fit">
              <input
                {...register("is_admin")}
                type="checkbox"
                className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
              />
              <span className={labelClass}>Invitar como administrador</span>
            </label>

            {errors.root && (
              <div className="bg-error-container rounded-xl px-4 py-3">
                <p className="text-error text-sm font-body">{errors.root.message}</p>
              </div>
            )}

            {inviteSuccess && (
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-base text-tertiary">check_circle</span>
                {inviteSuccess}
              </div>
            )}

            <Button type="submit" disabled={isSubmitting || inviteMutation.isPending}>
              {inviteMutation.isPending ? "Enviando…" : "Enviar invitación"}
            </Button>
          </form>
        </section>

        {/* ── Lista de usuarios ── */}
        <section className="space-y-4">
          <h2 className="font-headline text-xl font-bold text-on-surface">
            Usuarios ({users.length})
          </h2>

          {actionError && (
            <div className="bg-error-container rounded-xl px-4 py-3">
              <p className="text-error text-sm font-body">{actionError}</p>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-surface-container-high rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No hay usuarios.</p>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="bg-surface-container-lowest rounded-2xl p-4 shadow-editorial space-y-3"
                >
                  {/* Fila principal */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-on-surface text-sm truncate">
                          {u.name}
                        </span>
                        {statusBadge(u)}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container uppercase tracking-wide">
                          {roleLabel(u)}
                        </span>
                        {u.must_change_password && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wide">
                            Cambio contraseña
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                        {u.email}
                      </p>
                    </div>
                  </div>

                  {/* Acciones */}
                  {!u.is_guest && (
                    <div className="flex flex-wrap gap-2">
                      {/* Reenviar invitación (solo si pendiente) */}
                      {u.has_pending_invite && (
                        <button
                          onClick={() => handleResend(u.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-outline text-on-surface-variant hover:bg-surface-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">forward_to_inbox</span>
                          Reenviar invitación
                        </button>
                      )}

                      {/* Activar / desactivar */}
                      <button
                        onClick={() => handleToggle(u.id)}
                        className={[
                          "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors",
                          u.is_active
                            ? "border-outline text-on-surface-variant hover:bg-surface-container"
                            : "border-primary text-primary hover:bg-primary/5",
                        ].join(" ")}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {u.is_active ? "person_off" : "person_check"}
                        </span>
                        {u.is_active ? "Desactivar" : "Activar"}
                      </button>

                      {/* Cambiar rol (no para la propia cuenta del admin actual) */}
                      <button
                        onClick={() => handleRoleChange(u.id, !u.is_admin)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-outline text-on-surface-variant hover:bg-surface-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {u.is_admin ? "person_remove" : "manage_accounts"}
                        </span>
                        {u.is_admin ? "Quitar admin" : "Hacer admin"}
                      </button>

                      {/* Eliminar */}
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-error/40 text-error hover:bg-error-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
