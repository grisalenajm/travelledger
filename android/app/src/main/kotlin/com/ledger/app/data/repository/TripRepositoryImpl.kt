package com.ledger.app.data.repository

import com.ledger.app.data.local.room.dao.PendingOperationDao
import com.ledger.app.data.local.room.dao.TripDao
import com.ledger.app.data.local.room.entity.PendingOperationEntity
import com.ledger.app.data.local.room.entity.toDomain
import com.ledger.app.data.local.room.entity.toEntity
import com.ledger.app.data.remote.api.TripApi
import com.ledger.app.data.remote.api.dto.TripCreateDto
import com.ledger.app.domain.model.Trip
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TripRepositoryImpl @Inject constructor(
    private val tripDao: TripDao,
    private val pendingOpDao: PendingOperationDao,
    private val tripApi: TripApi,
    private val json: Json,
) : TripRepository {

    override fun getTrips(): Flow<List<Trip>> =
        tripDao.getAll().map { list -> list.map { it.toDomain() } }

    override fun getActiveTrips(): Flow<List<Trip>> =
        tripDao.getActive(LocalDate.now().toString()).map { list -> list.map { it.toDomain() } }

    override fun observePendingOpsCount(): Flow<Int> = pendingOpDao.countPendingOrFailed()

    override suspend fun create(trip: Trip): Result<Trip> = runCatching {
        withContext(Dispatchers.IO) {
            tripDao.upsert(trip.toEntity(syncPending = true))
            val op = PendingOperationEntity(
                operationId = trip.id,
                type = "create_trip",
                payload = json.encodeToString(trip.toCreateDto()),
                createdAt = System.currentTimeMillis(),
            )
            pendingOpDao.upsert(op)
            runCatching {
                tripApi.createTrip(trip.toCreateDto())
                tripDao.upsert(trip.toEntity(syncPending = false))
                pendingOpDao.updateStatus(op.operationId, "done", null, System.currentTimeMillis())
            }
            trip
        }
    }

    override suspend fun update(trip: Trip): Result<Trip> = runCatching {
        withContext(Dispatchers.IO) {
            tripDao.upsert(trip.toEntity(syncPending = true))
            val opId = UUID.randomUUID().toString()
            val op = PendingOperationEntity(
                operationId = opId,
                type = "update_trip",
                payload = json.encodeToString(trip.toCreateDto()),
                createdAt = System.currentTimeMillis(),
            )
            pendingOpDao.upsert(op)
            runCatching {
                tripApi.updateTrip(trip.id, trip.toCreateDto())
                tripDao.upsert(trip.toEntity(syncPending = false))
                pendingOpDao.updateStatus(opId, "done", null, System.currentTimeMillis())
            }
            trip
        }
    }

    override suspend fun delete(id: String): Result<Unit> = runCatching {
        withContext(Dispatchers.IO) {
            tripDao.delete(id)
            val opId = UUID.randomUUID().toString()
            val op = PendingOperationEntity(
                operationId = opId,
                type = "delete_trip",
                payload = """{"id":"$id"}""",
                createdAt = System.currentTimeMillis(),
            )
            pendingOpDao.upsert(op)
            runCatching {
                tripApi.deleteTrip(id)
                pendingOpDao.updateStatus(opId, "done", null, System.currentTimeMillis())
            }
        }
    }

    override suspend fun syncFromServer(): Result<Unit> = runCatching {
        withContext(Dispatchers.IO) {
            val trips = tripApi.getTrips()
            trips.forEach { dto -> tripDao.upsert(dto.toEntity()) }
        }
    }
}

private fun Trip.toCreateDto(): TripCreateDto = TripCreateDto(
    id = id,
    name = name,
    description = description,
    destination = destination,
    start_date = startDate.toString(),
    end_date = endDate.toString(),
    primary_currency = primaryCurrency,
    budget = budget,
    budget_currency = budgetCurrency,
    status = status.name,
)
