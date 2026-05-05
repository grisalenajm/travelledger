package com.ledger.app.data.remote.api

import com.ledger.app.data.remote.api.dto.ConvertResponseDto
import retrofit2.http.GET
import retrofit2.http.Query

interface CurrencyApi {

    @GET("api/currencies/convert")
    suspend fun convert(
        @Query("amount") amount: Double,
        @Query("from") from: String,
        @Query("to") to: String,
        @Query("date") date: String,
    ): ConvertResponseDto
}
