package com.ledger.app.data.repository

import com.ledger.app.domain.model.Trip
import kotlinx.coroutines.flow.Flow

interface TripRepository {
    fun getTrips(): Flow<List<Trip>>
    fun getActiveTrips(): Flow<List<Trip>>
    fun observePendingOpsCount(): Flow<Int>
    suspend fun create(trip: Trip): Result<Trip>
    suspend fun update(trip: Trip): Result<Trip>
    suspend fun delete(id: String): Result<Unit>
    suspend fun syncFromServer(): Result<Unit>
}
