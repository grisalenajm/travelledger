package com.ledger.app.data.repository

import com.ledger.app.data.remote.api.CurrencyApi
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CurrencyRepositoryImpl @Inject constructor(
    private val currencyApi: CurrencyApi,
) : CurrencyRepository {

    private val cache = mutableMapOf<Triple<String, String, LocalDate>, Double>()

    override suspend fun getRate(from: String, to: String, date: LocalDate): Result<Double> {
        if (from == to) return Result.success(1.0)
        val key = Triple(from, to, date)
        cache[key]?.let { return Result.success(it) }
        return runCatching {
            val response = currencyApi.convert(
                amount = 1.0,
                from = from,
                to = to,
                date = date.toString(),
            )
            cache[key] = response.rate
            response.rate
        }
    }
}
