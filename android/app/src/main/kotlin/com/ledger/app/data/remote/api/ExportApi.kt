package com.ledger.app.data.remote.api

import okhttp3.ResponseBody
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

interface ExportApi {
    @GET("api/reports/export/{tripId}")
    @Streaming
    suspend fun downloadCsv(
        @Path("tripId") tripId: String,
        @Query("format") format: String = "csv",
    ): ResponseBody
}
