# DESIGN_SYSTEM — Pantallas Nuevas (apéndice)

> Este fichero complementa DESIGN_SYSTEM.md con las pantallas que no estaban en el stitch original.
> Todos los tokens, tipografía, colores y efectos son los mismos que en DESIGN_SYSTEM.md.
> Consultar DESIGN_SYSTEM.md antes de implementar cualquiera de estas pantallas.

---

## Pantallas Nuevas — Especificaciones

### 5. Itinerario — Tramos del viaje (`/trips/[id]/itinerary`)

**Propósito:** lista cronológica de todos los tramos del viaje (transporte, alojamiento, alquiler de coche). Informativa, no genera gastos.

**Layout:**
- Header con nombre del viaje + botón volver (mismo patrón que `/trips/[id]`)
- Filter chips horizontales: Todos / Vuelos / Alojamiento / Coche / Transporte terrestre
- Lista vertical de `LegCard`
- Botón "Añadir tramo" sticky en la parte inferior

**Modos disponibles:**
| Modo | Categoría | Icono Material Symbols |
|------|-----------|------------------------|
| `flight` | Transporte | `flight` |
| `train` | Transporte | `train` |
| `bus` | Transporte | `directions_bus` |
| `ferry` | Transporte | `directions_boat` |
| `other` | Transporte | `luggage` |
| `accommodation` | Alojamiento | `hotel` |
| `car_rental` | Coche | `car_rental` |

**Filtro "Transporte terrestre"** agrupa: `train | bus | ferry | other`

---

#### LegCard — modo transporte (flight / train / bus / ferry / other)

```
┌─────────────────────────────────────────────────────┐
│  [icono modo]  MAD  →→→→→→→→→→→→→→→→→→→→→  BCN     │
│  Vuelo · Iberia IB6827      23:55  →  01:30          │
│  593 km · Loc: XYZABC       [💳 Iberia Plus]  [📎] [🧾] │
└─────────────────────────────────────────────────────┘
```

- Origen y destino en texto grande
- Línea 2: carrier + número de vuelo/tren, horas salida → llegada
- Línea 3: distancia (solo si `distance_km`), localizador, badge loyalty card
- Iconos opcionales: `📎` (attach_file) si `has_document`, `🧾` (receipt) si `expense_id`

#### LegCard — modo accommodation

```
┌─────────────────────────────────────────────────────┐
│  [hotel]  Hotel Arts Barcelona                       │
│  Carrer de la Marina 19–21                           │
│  Check-in: 15 may · Check-out: 18 may  [📎]  [🧾]  │
└─────────────────────────────────────────────────────┘
```

#### LegCard — modo car_rental

```
┌─────────────────────────────────────────────────────┐
│  [car_rental]  Hertz — Recogida: Aeropuerto BCN      │
│  Devolución: Estación Sants                          │
│  12 may 10:00 → 15 may 18:00  [📎]  [🧾]            │
└─────────────────────────────────────────────────────┘
```

**Acciones en tarjeta:** botón editar (lápiz) + botón borrar (papelera). El borrado requiere doble confirmación: primer click muestra overlay, segundo click ejecuta.

---

**Badge loyalty card:**
- `bg-primary-fixed text-primary-container` pill pequeño con alias de la tarjeta
- Solo se muestra si hay `loyalty_card_id` (solo en modos de transporte)

**Formulario nuevo/editar tramo (modal `add-leg-modal.tsx`):**
- Selector modo: 7 pills con iconos
- Campos dinámicos según modo seleccionado:
  - **Transporte:** origen, destino, salida (datetime-local), llegada (datetime-local), carrier, nº vuelo, reserva, localizador, asiento, loyalty card
  - **Alojamiento:** nombre, dirección, proveedor, check-in, check-out
  - **Coche:** empresa, recogida, devolución, fechas recogida/devolución, nº confirmación
- **Campo común:** notas (textarea, opcional)
- **Vincular gasto:** dropdown con gastos del viaje (opcional)
- **Documento adjunto:** input file (jpg/png/pdf/webp, max 10 MB)
- Edición: campos pre-rellenados con `leg` existente; `datetime-local` necesita slice a 16 chars (`YYYY-MM-DDTHH:MM`)

---

### 6. Loyalty Cards — Tarjetas de viajero (`/settings/cards`)

**Propósito:** gestión de tarjetas de programas de fidelización del usuario.

**Layout:**
- Lista de cards con borde-left de color según program_type
- FAB o botón "Añadir tarjeta"

**LoyaltyCard item:**
```
┌─────────────────────────────────────────────────────┐
│  [badge tipo]  Iberia Plus              [Gold pill]  │
│  IB-XXXX-XXXX-XXX  ·  alias: "Iberia personal"       │
└─────────────────────────────────────────────────────┘
```

**Colores badge program_type:**
| Tipo | Clases |
|------|--------|
| airline | `bg-primary-fixed text-primary-container` |
| train | `bg-secondary-fixed text-on-secondary-fixed-variant` |
| hotel | `bg-tertiary-fixed text-on-tertiary-fixed-variant` |
| car_rental | `bg-surface-container-highest text-on-surface-variant` |
| other | `bg-surface-container text-on-surface-variant` |

**Tier pill:** `bg-surface-container-highest text-on-surface font-label text-[10px] uppercase tracking-widest`

**Formulario nueva tarjeta:**
- program_type (selector con iconos)
- program_name (texto libre: "Iberia Plus", "Miles & More"…)
- membership_number
- tier (opcional)
- alias (opcional)

---

### 7. Export Modal (en `/trips/[id]`)

**Propósito:** opciones de exportación del viaje.

**Trigger:** botón "Exportar" en el header de la página de detalle del viaje.

**Modal / drawer:**
```
Exportar gastos
───────────────────────────────
  Gastos a incluir
  ○ Todos  ● Solo facturables

  Rango de fechas (opcional)
  [  Desde  ]  [  Hasta  ]

  [  Descargar CSV  ]
  [  Descargar ZIP (CSV + facturas)  ]
───────────────────────────────
```

**Estilos:**
- Toggle "Solo facturables": mismo estilo que el resto de toggles de la app
- Botones: `rounded-full` con `bg-primary text-on-primary` para el ZIP
  y `bg-surface-container-lowest border border-outline-variant/15` para el CSV
- Date picker: usar el componente de shadcn/ui `DatePickerWithRange`

---

### 8. Dashboard — Actualización para nuevas monedas

**Cambio respecto al stitch original:**
Los totales de las bento cards ya no son solo `amount`, son `amount_base` (en `User.currency_base`).

- Header del bento: añadir indicador de moneda base debajo del título
  ```
  SPENT AMOUNT
  CHF 3.744,12     ← amount_base acumulado
  ```
- Barra de progreso: compara `sum(amount_base)` vs `budget` convertido a `currency_base`
- Si `budget_currency != currency_base`, añadir subtexto con el presupuesto original:
  ```
  72% · CHF 3.744 de CHF 5.200
  Budget original: ARS 5.200.000
  ```

---

### 9. AddExpense Form — Campos nuevos

**Campos adicionales respecto al stitch:**

- **Moneda del gasto:** selector ISO con búsqueda. Por defecto: `Trip.primary_currency`.
  El usuario puede cambiarla. Mostrar preview del `amount_base` calculado en tiempo real.
- **Facturable:** toggle. Por defecto: ON (true).
- **Tarjeta de viajero (optional):** dropdown con las loyalty cards del usuario.
  Texto: "Acreditar a programa de puntos" con icono.

**Preview de conversión en tiempo real:**
```
€ 84,50  →  CHF 92,15
```
(calcular en frontend con el tipo del día ya cacheado)

**Flujo A vs Flujo B — indicador visual:**
- Flujo A (manual): header normal "Nuevo gasto"
- Flujo B (post-OCR): TopBar con badge "OCR COMPLETADO" en verde
  y todos los campos pre-rellenados del OcrResultDto

---

## Android — Componentes nuevos (equivalencias Compose)

| Componente Web | Equivalente Compose |
|----------------|---------------------|
| LegCard | `ElevatedCard` con `Row` icono-origen-flecha-destino |
| LoyaltyCard item | `ListItem` con `LeadingContent` badge tipo |
| Export bottom sheet | `ModalBottomSheet` con toggles y botones |
| Moneda selector | `ExposedDropdownMenuBox` con búsqueda |
| Facturable toggle | `Switch` con label inline |
| Preview conversión | `Text` con `animateContentSize` |
