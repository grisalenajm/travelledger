package com.ledger.app.data.local.room

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.ledger.app.data.local.room.dao.ExpenseDao
import com.ledger.app.data.local.room.dao.PendingOperationDao
import com.ledger.app.data.local.room.dao.TripDao
import com.ledger.app.data.local.room.entity.ExpenseEntity
import com.ledger.app.data.local.room.entity.PendingOperationEntity
import com.ledger.app.data.local.room.entity.TripEntity

@Database(
    entities = [TripEntity::class, ExpenseEntity::class, PendingOperationEntity::class],
    version = 2,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun tripDao(): TripDao
    abstract fun expenseDao(): ExpenseDao
    abstract fun pendingOperationDao(): PendingOperationDao

    companion object {
        fun create(context: Context): AppDatabase = Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "ledger.db",
        )
            .fallbackToDestructiveMigration()
            .build()
    }
}
