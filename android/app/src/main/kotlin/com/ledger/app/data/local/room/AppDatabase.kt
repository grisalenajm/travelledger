package com.ledger.app.data.local.room

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.ledger.app.data.local.room.dao.ExpenseDao
import com.ledger.app.data.local.room.dao.PendingOperationDao
import com.ledger.app.data.local.room.dao.TripDao
import com.ledger.app.data.local.room.entity.ExpenseEntity
import com.ledger.app.data.local.room.entity.PendingOperationEntity
import com.ledger.app.data.local.room.entity.TripEntity

@Database(
    entities = [TripEntity::class, ExpenseEntity::class, PendingOperationEntity::class],
    version = 3,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun tripDao(): TripDao
    abstract fun expenseDao(): ExpenseDao
    abstract fun pendingOperationDao(): PendingOperationDao

    companion object {
        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL(
                    "ALTER TABLE expenses ADD COLUMN isDraft INTEGER NOT NULL DEFAULT 0"
                )
            }
        }

        fun create(context: Context): AppDatabase = Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "ledger.db",
        )
            .addMigrations(MIGRATION_2_3)
            .fallbackToDestructiveMigration()
            .build()
    }
}
