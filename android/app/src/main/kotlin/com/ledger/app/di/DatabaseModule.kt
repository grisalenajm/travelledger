package com.ledger.app.di

import android.content.Context
import com.ledger.app.data.local.room.AppDatabase
import com.ledger.app.data.local.room.dao.ExpenseDao
import com.ledger.app.data.local.room.dao.PendingOperationDao
import com.ledger.app.data.local.room.dao.TripDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase =
        AppDatabase.create(context)

    @Provides
    @Singleton
    fun provideTripDao(db: AppDatabase): TripDao = db.tripDao()

    @Provides
    @Singleton
    fun provideExpenseDao(db: AppDatabase): ExpenseDao = db.expenseDao()

    @Provides
    @Singleton
    fun providePendingOperationDao(db: AppDatabase): PendingOperationDao =
        db.pendingOperationDao()
}
