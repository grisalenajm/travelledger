package com.ledger.app.fake

import com.ledger.app.data.repository.CurrencyRepository
import java.time.LocalDate

class FakeCurrencyRepository : CurrencyRepository {

    var rateToReturn: Result<Double> = Result.success(1.0)
    var getRateCalled = false
    var lastFrom: String? = null
    var lastTo: String? = null

    override suspend fun getRate(from: String, to: String, date: LocalDate): Result<Double> {
        getRateCalled = true
        lastFrom = from
        lastTo = to
        return rateToReturn
    }
}
