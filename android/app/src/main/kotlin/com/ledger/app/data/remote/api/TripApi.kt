package com.ledger.app.data.remote.api

import com.ledger.app.data.remote.api.dto.TripCreateDto
import com.ledger.app.data.remote.api.dto.TripDto
import com.ledger.app.data.remote.api.dto.TripSummaryDto
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface TripApi {

    @GET("api/trips")
    suspend fun getTrips(): List<TripDto>

    @GET("api/trips/{id}")
    suspend fun getTrip(@Path("id") id: String): TripDto

    @POST("api/trips")
    suspend fun createTrip(@Body body: TripCreateDto): TripDto

    @PUT("api/trips/{id}")
    suspend fun updateTrip(@Path("id") id: String, @Body body: TripCreateDto): TripDto

    @DELETE("api/trips/{id}")
    suspend fun deleteTrip(@Path("id") id: String)

    @GET("api/trips/{id}/summary")
    suspend fun getSummary(@Path("id") id: String): TripSummaryDto
}
