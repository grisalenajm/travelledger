package com.ledger.app.data.local.room.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ledger.app.data.local.room.entity.ExpenseEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ExpenseDao {

    @Query("SELECT * FROM expenses WHERE tripId = :tripId AND date = :date ORDER BY createdAt DESC")
    fun getByTripAndDate(tripId: String, date: String): Flow<List<ExpenseEntity>>

    @Query("SELECT * FROM expenses WHERE tripId = :tripId ORDER BY date DESC, createdAt DESC")
    fun getByTrip(tripId: String): Flow<List<ExpenseEntity>>

    @Query("SELECT * FROM expenses WHERE id = :id")
    suspend fun getById(id: String): ExpenseEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(expense: ExpenseEntity)

    @Query("DELETE FROM expenses WHERE id = :id")
    suspend fun delete(id: String)

    @Query("SELECT * FROM expenses WHERE syncPending = 1")
    suspend fun getPending(): List<ExpenseEntity>
}
