package com.ledger.app.di

import android.content.Context
import com.ledger.app.data.local.datastore.ConfigStore
import com.ledger.app.data.local.datastore.TokenStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DataStoreModule {

    @Provides
    @Singleton
    fun provideTokenStore(@ApplicationContext context: Context): TokenStore = TokenStore(context)

    @Provides
    @Singleton
    fun provideConfigStore(@ApplicationContext context: Context): ConfigStore = ConfigStore(context)
}
