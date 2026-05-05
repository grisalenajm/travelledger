package com.ledger.app.di

import com.ledger.app.data.repository.AuthRepository
import com.ledger.app.data.repository.AuthRepositoryImpl
import com.ledger.app.data.repository.CurrencyRepository
import com.ledger.app.data.repository.CurrencyRepositoryImpl
import com.ledger.app.data.repository.ExpenseRepository
import com.ledger.app.data.repository.ExpenseRepositoryImpl
import com.ledger.app.data.repository.TripRepository
import com.ledger.app.data.repository.TripRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    @Singleton
    abstract fun bindTripRepository(impl: TripRepositoryImpl): TripRepository

    @Binds
    @Singleton
    abstract fun bindExpenseRepository(impl: ExpenseRepositoryImpl): ExpenseRepository

    @Binds
    @Singleton
    abstract fun bindCurrencyRepository(impl: CurrencyRepositoryImpl): CurrencyRepository
}
