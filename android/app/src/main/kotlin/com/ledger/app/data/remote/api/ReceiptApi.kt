package com.ledger.app.data.remote.api

import com.ledger.app.data.remote.api.dto.ExpenseDto
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

interface ReceiptApi {
    @Multipart
    @POST("api/receipts/upload")
    suspend fun uploadReceipt(
        @Part file: MultipartBody.Part,
        @Part("trip_id") tripId: RequestBody,
    ): ExpenseDto
}
