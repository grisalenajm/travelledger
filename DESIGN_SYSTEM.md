# DESIGN_SYSTEM.md — Ledger / Travel Expenses

> Extraído del stitch de referencia. **Fuente de verdad visual** para los agentes Web y Android.
> Consultar antes de crear cualquier componente o pantalla.

---

## 🎨 Identidad Visual

**Nombre de producto:** Ledger  
**Personalidad:** Editorial · Refinado · Funcional · Viaje  
**Inspiración:** Revista de viajes de alta gama, no app de contabilidad

---

## 🔤 Tipografía

| Rol | Familia | Pesos | Uso |
|-----|---------|-------|-----|
| `headline` | **Manrope** | 400, 700, 800 | Títulos, cifras, importes |
| `body` | **Public Sans** | 300, 400, 500, 600 | Cuerpo de texto, navegación |
| `label` | **Public Sans** | 400, 500, 600 | Labels, badges, tags |

### Escala tipográfica en uso

```
Título principal:   font-headline text-4xl md:text-5xl font-extrabold tracking-tight
Subtítulo sección:  font-headline text-xl font-bold
Importe grande:     font-headline text-3xl font-bold
Importe tarjeta:    font-headline text-xl font-bold
Label uppercase:    font-label text-[10px] font-bold tracking-widest uppercase
Body texto:         font-body text-sm / font-body text-base
Timestamp:          text-xs text-on-surface-variant font-medium
```

---

## 🎨 Paleta de Colores (Material You tokens)

Todos los colores están definidos como tokens. **Nunca usar hex directamente en componentes**, usar el token.

### Colores primarios

| Token | Hex | Uso |
|-------|-----|-----|
| `primary` | `#004d64` | Color principal, CTAs, logo, importes |
| `primary-container` | `#006684` | Cards hero, fondos de énfasis |
| `primary-fixed` | `#bee9ff` | Badges transporte, fondos suaves |
| `primary-fixed-dim` | `#87d0f2` | Variante dim |
| `inverse-primary` | `#87d0f2` | Dark mode primary |

### Colores de superficie (los más usados)

| Token | Hex | Uso |
|-------|-----|-----|
| `surface` / `background` | `#faf9fc` | Fondo general, TopAppBar |
| `surface-container-lowest` | `#ffffff` | Cards, inputs |
| `surface-container-low` | `#f4f3f6` | Fondos secundarios, campos textarea |
| `surface-container` | `#eeedf1` | Contenedores medios |
| `surface-container-high` | `#e8e8eb` | Hover states |
| `surface-container-highest` | `#e2e2e5` | Máximo contraste en superficie |

### Colores secundario y terciario

| Token | Hex | Uso |
|-------|-----|-----|
| `secondary` | `#526166` | Iconos, texto secundario activo |
| `secondary-container` | `#d5e5eb` | Fondo de iconos en tarjetas |
| `secondary-fixed` | `#d5e5eb` | Badge Lodging |
| `tertiary` | `#6b3a00` | Badges Dining, estados de OCR/scanning |
| `tertiary-container` | `#885116` | Icono processing OCR |
| `tertiary-fixed` | `#ffdcc0` | Fondo warm para warnings suaves |

### Colores semánticos

| Token | Hex | Uso |
|-------|-----|-----|
| `error` | `#ba1a1a` | Errores |
| `error-container` | `#ffdad6` | Fondo errores |
| `outline` | `#70787e` | Bordes, separadores |
| `outline-variant` | `#bfc8cd` | Bordes suaves, divisores |

### Colores de texto

| Token | Hex | Uso |
|-------|-----|-----|
| `on-surface` | `#1a1c1e` | Texto principal |
| `on-surface-variant` | `#3f484d` | Texto secundario, labels, hints |
| `on-primary` | `#ffffff` | Texto sobre primary |
| `on-primary-container` | `#a2e1ff` | Texto sobre primary-container |
| `on-secondary-container` | `#58676c` | Texto sobre secondary-container |
| `on-tertiary-container` | `#ffcfa6` | Texto sobre tertiary-container |

---

## 📐 Border Radius

```
DEFAULT  → 0.125rem (2px)   — bordes casi cuadrados (inputs con border-b)
lg       → 0.25rem (4px)    — variante pequeña
xl       → 0.5rem (8px)     — cards internas, badges
full     → 0.75rem (12px)   — pills, chips, bottom nav, FAB, modales
```

**Nota:** `rounded-full` en Tailwind = `border-radius: 9999px` en CSS estándar, pero en el config de este proyecto `rounded-full = 0.75rem`. Usar `rounded-full` para pills y FABs, `rounded-xl` para cards.

---

## 🧩 Componentes del Design System

### TopAppBar

```html
<header class="fixed top-0 w-full z-50 bg-[#faf9fc]">
  <div class="flex items-center justify-between px-6 h-16 w-full max-w-screen-xl mx-auto">
    <!-- Left: menu button + logo -->
    <div class="flex items-center gap-4">
      <button class="material-symbols-outlined text-[#3f484d] hover:bg-[#f4f3f6] p-2 rounded-full">
        menu
      </button>
      <h1 class="font-headline font-bold text-xl text-[#004d64] tracking-tight">Ledger</h1>
    </div>
    <!-- Right: avatar -->
    <div class="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/15">
      <img src="..." alt="avatar"/>
    </div>
  </div>
</header>
```

### BottomNavBar (móvil)

```html
<nav class="fixed bottom-0 left-0 w-full z-50 rounded-t-xl 
            bg-[#faf9fc]/70 backdrop-blur-xl 
            shadow-[0_-8px_32px_rgba(26,28,30,0.06)] 
            border-t border-[#bfc8cd]/15">
  <div class="flex justify-around items-center px-4 pb-4 pt-2 max-w-screen-xl mx-auto">
    
    <!-- Item inactivo -->
    <div class="flex flex-col items-center text-[#3f484d] p-2 hover:text-[#004d64] cursor-pointer">
      <span class="material-symbols-outlined">dashboard</span>
      <span class="text-[11px] font-medium mt-1">Dashboard</span>
    </div>

    <!-- Item activo -->
    <div class="flex flex-col items-center bg-[#004d64] text-white rounded-full p-3 mb-1">
      <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">receipt_long</span>
    </div>

  </div>
</nav>
```

Tabs: **Dashboard · Activity · Scan · Settings**

### ExpenseCard (tarjeta de gasto)

```html
<!-- Patrón: icono flotante en esquina superior izquierda -->
<div class="relative bg-surface-container-lowest p-6 rounded-xl 
            group hover:translate-y-[-4px] transition-all duration-300">
  
  <!-- Icono de categoría flotante -->
  <div class="absolute -top-4 -left-2 w-10 h-10 rounded-full 
              bg-secondary-container flex items-center justify-center 
              text-primary shadow-sm">
    <span class="material-symbols-outlined text-xl">restaurant</span>
  </div>

  <!-- Contenido -->
  <div class="pt-2 flex justify-between items-start mb-4">
    <div>
      <h3 class="font-headline font-bold text-lg text-on-surface">Le Bistrot Paris</h3>
      <p class="text-on-surface-variant text-sm font-label">Paris, France</p>
    </div>
    <span class="font-headline font-bold text-xl text-primary">€84.50</span>
  </div>

  <!-- Footer: fecha + badge categoría -->
  <div class="flex items-center justify-between mt-6 pt-4 border-t border-outline-variant/10">
    <span class="text-xs text-on-surface-variant font-medium">14 OCT 2023</span>
    <span class="bg-tertiary-container/20 text-tertiary px-3 py-1 rounded-full 
                 text-[10px] font-bold uppercase tracking-wider">Dining</span>
  </div>
</div>
```

**Estado procesando OCR** (card esqueleto):
```html
<div class="relative bg-surface-container-lowest p-6 rounded-xl 
            border-2 border-dashed border-tertiary-container/30">
  <!-- Icono pulsando -->
  <div class="absolute -top-4 -left-2 w-10 h-10 rounded-full 
              bg-tertiary-container flex items-center justify-center 
              text-on-tertiary-container shadow-sm animate-pulse">
    <span class="material-symbols-outlined text-xl">receipt_long</span>
  </div>
  <!-- Skeleton lines -->
  <div class="pt-2 flex justify-between items-start mb-4">
    <div class="space-y-2">
      <div class="h-5 w-32 bg-surface-container rounded animate-pulse"></div>
      <div class="h-3 w-20 bg-surface-container-low rounded animate-pulse"></div>
    </div>
    <div class="h-6 w-20 bg-surface-container rounded animate-pulse"></div>
  </div>
  <!-- Estado -->
  <span class="flex items-center gap-2 text-tertiary font-bold text-xs">
    <span class="material-symbols-outlined text-sm">sync</span>
    SCANNING RECEIPT...
  </span>
</div>
```

### Badge de categoría

| Categoría | Clases |
|-----------|--------|
| Dining | `bg-tertiary-container/20 text-tertiary` |
| Lodging | `bg-secondary-fixed text-on-secondary-fixed-variant` |
| Transport | `bg-primary-fixed text-primary-container` |
| Culture | `bg-surface-container-highest text-on-surface-variant` |

```html
<span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider {clases}">
  Dining
</span>
```

### Bento Stats Cards

```html
<!-- Card normal -->
<div class="bg-surface-container-lowest rounded-xl p-8 
            shadow-[0_8px_32px_rgba(26,28,30,0.06)] 
            relative overflow-hidden flex flex-col justify-between h-48">
  <div class="z-10">
    <span class="text-on-surface-variant text-sm font-medium uppercase tracking-wider">Total Budget</span>
    <h3 class="text-3xl font-headline font-bold text-on-surface mt-2">$5,200.00</h3>
  </div>
  <!-- Icono decorativo de fondo -->
  <span class="absolute -right-4 -bottom-4 material-symbols-outlined 
               text-surface-container text-9xl opacity-50 pointer-events-none">
    account_balance_wallet
  </span>
</div>

<!-- Card hero (primary-container) -->
<div class="bg-primary-container rounded-xl p-8 relative overflow-hidden 
            flex flex-col justify-between h-48 text-white">
  <span class="text-on-primary-container text-sm font-medium uppercase tracking-wider">Spent Amount</span>
  <h3 class="text-3xl font-headline font-bold text-white mt-2">$3,744.12</h3>
</div>
```

### FAB (Floating Action Button)

```html
<!-- FAB principal con texto -->
<button class="fixed bottom-24 right-6 bg-primary text-white 
               flex items-center gap-3 px-6 py-4 rounded-full 
               shadow-[0_8px_32px_rgba(0,77,100,0.25)] 
               hover:scale-105 transition-all duration-300 z-50">
  <span class="material-symbols-outlined">add_a_photo</span>
  <span class="font-label font-bold text-sm">Quick Entry</span>
</button>

<!-- FAB icon solo -->
<button class="fixed right-6 bottom-24 w-14 h-14 rounded-full text-white 
               flex items-center justify-center z-60 
               active:scale-90 transition-all duration-300"
        style="background: linear-gradient(135deg, #004d64 0%, #006684 100%)">
  <span class="material-symbols-outlined text-2xl">add</span>
</button>
```

### Progress Bar (presupuesto)

```html
<div class="bg-surface-container-low rounded-xl p-6">
  <div class="flex justify-between items-center mb-1">
    <span class="text-on-surface-variant font-medium text-sm">Spent of Budget</span>
    <span class="text-primary font-bold">72%</span>
  </div>
  <div class="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
    <div class="bg-primary h-full w-[72%]"></div>
  </div>
</div>
```

### Scanner Screen

```
Fondo: imagen de cámara oscurecida (brightness-50)
Overlay: viewfinder con border dashed border-primary/40 rounded-xl
Línea animada: scanning-line con animación CSS (top 10% → 90%, 3s linear infinite)
Chips OCR: bg-primary/80 backdrop-blur-md rounded-lg (fecha detectada)
           bg-tertiary-container/90 backdrop-blur-md rounded-xl (importe)
Control inferior: rounded-full con blur, botón cámara central w-16 h-16
```

```css
/* Animación de escaneo */
.scanning-line {
  height: 2px;
  background: linear-gradient(90deg, transparent, #004d64, transparent);
  box-shadow: 0 0 15px #006684;
  position: absolute;
  width: 100%;
  animation: scan 3s linear infinite;
}
@keyframes scan {
  0%   { top: 10%; opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { top: 90%; opacity: 0; }
}
```

### Confirm Expense Screen

```
Layout: grid asimétrico md:grid-cols-12
  - col-span-5: preview de la factura (imagen con grayscale-[20%])
  - col-span-7: formulario con campos pre-rellenados
  
Input importe: border-none, text-5xl font-headline font-extrabold, bg-transparent
Select/input fields: border-b-2 border-outline-variant focus:border-primary, bg-transparent
Textarea: bg-surface-container-low rounded-xl, sin borde
CTA sticky: fixed bottom-0, bg-surface/80 backdrop-blur-xl, botón rounded-full h-14
```

---

## 📏 Layout y Grid

```
Contenedor: max-w-screen-xl mx-auto
Padding horizontal: px-6
Padding top (con topbar fixed): pt-24
Padding bottom (con bottomnav fixed): pb-32

Grid de gastos: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8
Bento stats: grid-cols-1 md:grid-cols-3 gap-6
Dashboard main: grid-cols-1 lg:grid-cols-12 gap-8
  - Chart: lg:col-span-8
  - Side cards: lg:col-span-4
```

---

## 🔠 Iconografía

**Material Symbols Outlined** (variable font)

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1" rel="stylesheet"/>

<style>
  .material-symbols-outlined {
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }
</style>

<!-- Filled variant (nav activo, save button) -->
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">receipt_long</span>
```

### Iconos por sección

| Sección | Icono |
|---------|-------|
| Dashboard | `dashboard` |
| Activity | `receipt_long` |
| Scan | `document_scanner` |
| Settings | `settings` |
| OCR Processing | `sync` (animate-pulse) |
| Quick Entry FAB | `add_a_photo` |
| Restaurant | `restaurant` |
| Hotel | `hotel` |
| Transport | `train` |
| Café | `local_cafe` |
| Cultura | `museum` |
| Pending receipts | `sync`, `done_all` |

---

## ✨ Efectos y Animaciones

```css
/* Hover cards */
hover:translate-y-[-4px] transition-all duration-300

/* Hover FAB */
hover:scale-105 transition-all duration-300

/* Active press */
active:scale-95 transition-transform

/* Skeleton shimmer */
animate-pulse (Tailwind built-in)

/* BottomNav glass */
bg-[#faf9fc]/70 backdrop-blur-xl

/* Sombra editorial cards */
box-shadow: 0 8px 32px rgba(26, 28, 30, 0.06)

/* Sombra FAB */
box-shadow: 0 8px 32px rgba(0, 77, 100, 0.25)
```

---

## 📱 Pantallas Definidas en el Stitch

### 1. Expense Detail (`/trips/[id]`)
Grid 3 columnas de `ExpenseCard`. Header editorial con nombre del viaje y total. Filtros de categoría y fecha. FAB "Quick Entry".

### 2. Dashboard (`/`)
Header "Current Journey" + barra de progreso. Bento 3-col: Budget / Spent / Remaining. Chart donut "Spending Architecture" (lg:col-span-8) + side cards Pending Receipts (lg:col-span-4).

### 3. Confirm Expense (`/expenses/scan/confirm`)
Grid asimétrico 5/7. Preview factura + formulario pre-rellenado OCR. Sticky CTA "Guardar Gasto". TopBar con estado "OCR SCANNING" pulsando.

### 4. Scanner (`/expenses/scan`)
Full-screen cámara. Viewfinder dashed. Scanning line animada. Chips detectando fecha e importe. Control inferior glass con botón cámara central.

---

## 🚫 Qué NO hacer

- No usar `font-inter`, `font-roboto` ni fuentes del sistema
- No usar hex directamente — siempre tokens (`text-primary`, `bg-surface-container`)
- No usar border-radius > `rounded-full` (0.75rem) — el config lo limita
- No usar sombras distintas a las definidas arriba (editorial-shadow y FAB-shadow)
- No usar colores saturados o brillantes fuera del sistema
- No poner texto en mayúsculas para títulos principales — solo para labels y badges (`uppercase tracking-widest`)
- Los importes van siempre en `font-headline font-bold`

---

## 🤝 Uso en Android (Kotlin / Compose)

El agente Android debe **traducir** este design system a Material 3 con los mismos tokens:

```kotlin
// Color scheme equivalente Material 3
val LedgerColorScheme = lightColorScheme(
    primary = Color(0xFF004D64),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFF006684),
    onPrimaryContainer = Color(0xFFA2E1FF),
    secondary = Color(0xFF526166),
    secondaryContainer = Color(0xFFD5E5EB),
    tertiary = Color(0xFF6B3A00),
    tertiaryContainer = Color(0xFF885116),
    surface = Color(0xFFFAF9FC),
    onSurface = Color(0xFF1A1C1E),
    onSurfaceVariant = Color(0xFF3F484D),
    outline = Color(0xFF70787E),
    outlineVariant = Color(0xFFBFC8CD),
)

// Tipografía equivalente
val LedgerTypography = Typography(
    displayLarge = TextStyle(fontFamily = ManropeFontFamily, fontWeight = FontWeight.ExtraBold),
    headlineLarge = TextStyle(fontFamily = ManropeFontFamily, fontWeight = FontWeight.Bold),
    bodyMedium = TextStyle(fontFamily = PublicSansFontFamily, fontWeight = FontWeight.Normal),
    labelSmall = TextStyle(fontFamily = PublicSansFontFamily, fontWeight = FontWeight.Bold,
                           letterSpacing = 0.1.sp)
)

// Shapes equivalente
val LedgerShapes = Shapes(
    extraSmall = RoundedCornerShape(2.dp),   // DEFAULT
    small = RoundedCornerShape(4.dp),         // lg
    medium = RoundedCornerShape(8.dp),        // xl
    large = RoundedCornerShape(12.dp),        // full
    extraLarge = RoundedCornerShape(12.dp)
)
```

**Componentes Compose equivalentes:**
- `ExpenseCard` → `ElevatedCard` con `IconBadge` flotante
- `BottomNavBar` → `NavigationBar` con `NavigationBarItem`
- `FAB` → `ExtendedFloatingActionButton` (texto) o `FloatingActionButton` (icono)
- `Scanner` → `AndroidView` con `CameraX PreviewView` + overlay Compose
- `Scanning line` → `Canvas` animado con `animateFloat` + `InfiniteRepeatableSpec`
