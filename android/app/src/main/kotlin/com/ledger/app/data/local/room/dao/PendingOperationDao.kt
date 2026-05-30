package com.ledger.app.data.local.room.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import com.ledger.app.data.local.room.entity.PendingOperationEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PendingOperationDao {

    @Query("SELECT * FROM pending_operations WHERE status = 'pending' ORDER BY createdAt ASC")
    suspend fun getPending(): List<PendingOperationEntity>

    @Query("SELECT COUNT(*) FROM pending_operations WHERE status IN ('pending', 'failed')")
    fun countPendingOrFailed(): Flow<Int>

    @Upsert
    suspend fun upsert(operation: PendingOperationEntity)

    @Query(
        "UPDATE pending_operations SET status = :status, lastError = :error, " +
        "attempts = attempts + 1, lastAttemptAt = :now WHERE operationId = :id"
    )
    suspend fun updateStatus(id: String, status: String, error: String?, now: Long)

    @Query("DELETE FROM pending_operations WHERE status = 'done' AND createdAt < :cutoff")
    suspend fun deleteDoneBefore(cutoff: Long)
}
