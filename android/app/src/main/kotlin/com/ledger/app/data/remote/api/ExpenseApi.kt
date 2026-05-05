package com.ledger.app.data.remote.api

import com.ledger.app.data.remote.api.dto.ExpenseCreateDto
import com.ledger.app.data.remote.api.dto.ExpenseDto
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface ExpenseApi {

    @GET("api/expenses")
    suspend fun getExpenses(@Query("trip_id") tripId: String): List<ExpenseDto>

    @POST("api/expenses")
    suspend fun createExpense(@Body body: ExpenseCreateDto): ExpenseDto

    @PUT("api/expenses/{id}")
    suspend fun updateExpense(@Path("id") id: String, @Body body: ExpenseCreateDto): ExpenseDto

    @DELETE("api/expenses/{id}")
    suspend fun deleteExpense(@Path("id") id: String)
}
