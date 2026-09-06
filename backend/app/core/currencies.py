"""Fuente única de verdad para las monedas soportadas por Ledger.

Cualquier fichero que necesite validar o listar monedas importa de aquí —
nunca duplicar este set en otro fichero.
"""

CURRENCY_NAMES: dict[str, str] = {
    "AED": "Dirham de EAU", "ARS": "Peso argentino", "AUD": "Dólar australiano",
    "AZN": "Manat azerbaiyano", "BDT": "Taka bangladesí", "BHD": "Dinar bareiní",
    "BND": "Dólar de Brunéi", "BRL": "Real brasileño", "CAD": "Dólar canadiense",
    "CHF": "Franco suizo", "CLP": "Peso chileno", "CNY": "Yuan chino",
    "COP": "Peso colombiano", "CZK": "Corona checa", "DKK": "Corona danesa",
    "EGP": "Libra egipcia", "EUR": "Euro", "GBP": "Libra esterlina",
    "GEL": "Lari georgiano", "GHS": "Cedi ghanés", "HKD": "Dólar de Hong Kong",
    "HUF": "Florín húngaro", "IDR": "Rupia indonesia", "ILS": "Séquel israelí",
    "INR": "Rupia india", "ISK": "Corona islandesa", "JOD": "Dinar jordano",
    "JPY": "Yen japonés", "KES": "Chelín keniano", "KHR": "Riel camboyano",
    "KRW": "Won surcoreano", "KWD": "Dinar kuwaití", "KZT": "Tenge kazajo",
    "LAK": "Kip laosiano", "LKR": "Rupia esrilanquesa", "MAD": "Dirham marroquí",
    "MMK": "Kyat birmano", "MXN": "Peso mexicano", "MYR": "Ringgit malayo",
    "NGN": "Naira nigeriana", "NOK": "Corona noruega", "NPR": "Rupia nepalí",
    "NZD": "Dólar neozelandés", "OMR": "Rial omaní", "PEN": "Sol peruano",
    "PHP": "Peso filipino", "PKR": "Rupia pakistaní", "PLN": "Zloty polaco",
    "QAR": "Rial catarí", "RON": "Leu rumano", "RUB": "Rublo ruso",
    "SAR": "Riyal saudí", "SEK": "Corona sueca", "SGD": "Dólar de Singapur",
    "THB": "Baht tailandés", "TRY": "Lira turca", "TWD": "Dólar taiwanés",
    "UAH": "Grivna ucraniana", "USD": "Dólar estadounidense",
    "VND": "Dong vietnamita", "ZAR": "Rand sudafricano",
}

VALID_CURRENCIES: frozenset[str] = frozenset(CURRENCY_NAMES.keys())
