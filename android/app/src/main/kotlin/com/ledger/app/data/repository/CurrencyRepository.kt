package com.ledger.app.data.repository

import java.time.LocalDate

interface CurrencyRepository {
    suspend fun getRate(from: String, to: String, date: LocalDate): Result<Double>
}
