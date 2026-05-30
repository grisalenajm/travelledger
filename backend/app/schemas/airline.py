from pydantic import BaseModel


class AirlineRead(BaseModel):
    iata: str
    name: str
    country: str
    logo_url: str
