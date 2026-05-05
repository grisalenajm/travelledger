package com.ledger.app.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.ledger.app.data.local.room.dao.ExpenseDao
import com.ledger.app.data.local.room.dao.PendingOperationDao
import com.ledger.app.data.local.room.dao.TripDao
import com.ledger.app.data.local.room.entity.PendingOperationEntity
import com.ledger.app.data.remote.api.ExpenseApi
import com.ledger.app.data.remote.api.TripApi
import com.ledger.app.data.remote.api.dto.ExpenseCreateDto
import com.ledger.app.data.remote.api.dto.TripCreateDto
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val pendingOperationDao: PendingOperationDao,
    private val tripDao: TripDao,
    private val expenseDao: ExpenseDao,
    private val tripApi: TripApi,
    private val expenseApi: ExpenseApi,
    private val json: Json,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        cleanupDoneOps()

        val pending = pendingOperationDao.getPending()
        if (pending.isEmpty()) return Result.success()

        val ordered = pending.sortedWith(compareBy { opOrder(it.type) })

        var anyFailure = false
        for (op in ordered) {
            val success = processOp(op)
            if (!success) anyFailure = true
        }

        return if (anyFailure) Result.retry() else Result.success()
    }

    private fun opOrder(type: String): Int = when (type) {
        "create_trip" -> 0
        "create_expense" -> 1
        "update_trip", "update_expense" -> 2
        "delete_expense" -> 3
        "delete_trip" -> 4
        else -> 5
    }

    private suspend fun processOp(op: PendingOperationEntity): Boolean {
        val now = System.currentTimeMillis()
        return try {
            when (op.type) {
                "create_trip" -> {
                    val dto = json.decodeFromString<TripCreateDto>(op.payload)
                    tripApi.createTrip(dto)
                    val entity = tripDao.getById(op.operationId)
                    if (entity != null) tripDao.upsert(entity.copy(syncPending = false))
                }
                "update_trip" -> {
                    val dto = json.decodeFromString<TripCreateDto>(op.payload)
                    val id = dto.id ?: return false
                    tripApi.updateTrip(id, dto)
                    val entity = tripDao.getById(id)
                    if (entity != null) tripDao.upsert(entity.copy(syncPending = false))
                }
                "delete_trip" -> {
                    val id = json.parseJsonObject(op.payload)["id"] ?: return false
                    tripApi.deleteTrip(id)
                }
                "create_expense" -> {
                    val dto = json.decodeFromString<ExpenseCreateDto>(op.payload)
                    expenseApi.createExpense(dto)
                    val entity = expenseDao.getById(op.operationId)
                    if (entity != null) expenseDao.upsert(entity.copy(syncPending = false))
                }
                "update_expense" -> {
                    val dto = json.decodeFromString<ExpenseCreateDto>(op.payload)
                    val id = dto.id ?: return false
                    expenseApi.updateExpense(id, dto)
                    val entity = expenseDao.getById(id)
                    if (entity != null) expenseDao.upsert(entity.copy(syncPending = false))
                }
                "delete_expense" -> {
                    val id = json.parseJsonObject(op.payload)["id"] ?: return false
                    expenseApi.deleteExpense(id)
                }
                else -> { /* unknown op — mark done to not block queue */ }
            }
            pendingOperationDao.updateStatus(op.operationId, "done", null, now)
            true
        } catch (e: retrofit2.HttpException) {
            val isPermanent = e.code() in 400..499
            if (isPermanent || op.attempts >= MAX_ATTEMPTS) {
                pendingOperationDao.updateStatus(op.operationId, "failed", e.message, now)
            } else {
                pendingOperationDao.updateStatus(op.operationId, "pending", e.message, now)
            }
            false
        } catch (e: Exception) {
            if (op.attempts >= MAX_ATTEMPTS) {
                pendingOperationDao.updateStatus(op.operationId, "failed", e.message, now)
            } else {
                pendingOperationDao.updateStatus(op.operationId, "pending", e.message, now)
            }
            false
        }
    }

    private suspend fun cleanupDoneOps() {
        val sevenDaysAgo = System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000L
        pendingOperationDao.deleteDoneBefore(sevenDaysAgo)
    }

    private fun Json.parseJsonObject(payload: String): Map<String, String> {
        return try {
            parseToJsonElement(payload).jsonObject
                .mapValues { it.value.jsonPrimitive.content }
        } catch (e: Exception) {
            emptyMap()
        }
    }

    companion object {
        const val WORK_NAME = "ledger_sync"
        private const val MAX_ATTEMPTS = 5
    }
}
