"use client"

interface AirlineLogoProps {
  iata: string
  name: string
  size?: number
}

export function AirlineLogo({ iata, name, size = 32 }: AirlineLogoProps) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div
      style={{ width: size, height: size }}
      className="relative rounded-full overflow-hidden flex-shrink-0 bg-primary/10 flex items-center justify-center"
    >
      {/* Fallback iniciales — siempre presentes */}
      <span
        className="text-primary font-bold absolute"
        style={{ fontSize: Math.round(size * 0.35) }}
      >
        {initials}
      </span>
      {/* Logo externo — si carga, tapa las iniciales */}
      <img
        src={`https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`}
        alt={name}
        style={{ width: size, height: size }}
        className="absolute inset-0 object-contain bg-white"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = "none"
        }}
      />
    </div>
  )
}
