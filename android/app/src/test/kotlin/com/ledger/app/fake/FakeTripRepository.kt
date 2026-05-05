package com.ledger.app.fake

import com.ledger.app.data.repository.TripRepository
import com.ledger.app.domain.model.Trip
import com.ledger.app.domain.model.TripStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import java.time.LocalDate

class FakeTripRepository : TripRepository {

    private val _trips = MutableStateFlow<List<Trip>>(emptyList())
    private val _pendingCount = MutableStateFlow(0)

    var createResult: Result<Trip>? = null
    var updateResult: Result<Trip>? = null
    var deleteResult: Result<Unit> = Result.success(Unit)
    var syncFromServerCalled = false
    var syncFromServerResult: Result<Unit> = Result.success(Unit)

    fun setTrips(trips: List<Trip>) {
        _trips.value = trips
    }

    fun setPendingCount(count: Int) {
        _pendingCount.value = count
    }

    override fun getTrips(): Flow<List<Trip>> = _trips

    override fun getActiveTrips(): Flow<List<Trip>> = _trips.map { trips ->
        val today = LocalDate.now()
        trips.filter { trip ->
            trip.status == TripStatus.active &&
            !trip.startDate.isAfter(today) &&
            !trip.endDate.isBefore(today)
        }
    }

    override fun observePendingOpsCount(): Flow<Int> = _pendingCount

    override suspend fun create(trip: Trip): Result<Trip> =
        createResult ?: Result.success(trip)

    override suspend fun update(trip: Trip): Result<Trip> =
        updateResult ?: Result.success(trip)

    override suspend fun delete(id: String): Result<Unit> = deleteResult

    override suspend fun syncFromServer(): Result<Unit> {
        syncFromServerCalled = true
        return syncFromServerResult
    }
}
