package com.ledger.app.di

import retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.ledger.app.core.AuthEventBus
import com.ledger.app.data.camera.CameraManager
import com.ledger.app.data.local.datastore.ConfigStore
import com.ledger.app.data.local.datastore.TokenStore
import com.ledger.app.data.remote.api.AuthApi
import com.ledger.app.data.remote.api.ReceiptApi
import com.ledger.app.data.remote.interceptor.AuthInterceptor
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    @Provides
    @Singleton
    @Named("unauthenticated")
    fun provideUnauthOkHttp(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    fun provideAuthInterceptor(
        tokenStore: TokenStore,
        authEventBus: AuthEventBus,
        authApi: AuthApi,
    ): AuthInterceptor = AuthInterceptor(tokenStore, authEventBus, authApi)

    @Provides
    @Singleton
    @Named("authenticated")
    fun provideAuthOkHttp(authInterceptor: AuthInterceptor): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()

    @Provides
    @Singleton
    @Named("unauthenticated")
    fun provideUnauthRetrofit(
        @Named("unauthenticated") okHttpClient: OkHttpClient,
        json: Json,
        configStore: ConfigStore,
    ): Retrofit {
        val baseUrl = runBlocking { configStore.getServerUrl() } ?: "http://localhost:8000/"
        val normalizedUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        return Retrofit.Builder()
            .baseUrl(normalizedUrl)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    @Provides
    @Singleton
    @Named("authenticated")
    fun provideAuthRetrofit(
        @Named("authenticated") okHttpClient: OkHttpClient,
        json: Json,
        configStore: ConfigStore,
    ): Retrofit {
        val baseUrl = runBlocking { configStore.getServerUrl() } ?: "http://localhost:8000/"
        val normalizedUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        return Retrofit.Builder()
            .baseUrl(normalizedUrl)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    @Provides
    @Singleton
    fun provideAuthApi(@Named("unauthenticated") retrofit: Retrofit): AuthApi =
        retrofit.create(AuthApi::class.java)

    @Provides
    @Singleton
    fun provideTripApi(@Named("authenticated") retrofit: Retrofit): com.ledger.app.data.remote.api.TripApi =
        retrofit.create(com.ledger.app.data.remote.api.TripApi::class.java)

    @Provides
    @Singleton
    fun provideExpenseApi(@Named("authenticated") retrofit: Retrofit): com.ledger.app.data.remote.api.ExpenseApi =
        retrofit.create(com.ledger.app.data.remote.api.ExpenseApi::class.java)

    @Provides
    @Singleton
    fun provideCurrencyApi(@Named("authenticated") retrofit: Retrofit): com.ledger.app.data.remote.api.CurrencyApi =
        retrofit.create(com.ledger.app.data.remote.api.CurrencyApi::class.java)

    @Provides
    @Singleton
    fun provideReceiptApi(@Named("authenticated") retrofit: Retrofit): ReceiptApi =
        retrofit.create(ReceiptApi::class.java)
}
