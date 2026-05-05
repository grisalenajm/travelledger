package com.ledger.app.data.remote.interceptor

import com.ledger.app.core.AuthEvent
import com.ledger.app.core.AuthEventBus
import com.ledger.app.data.local.datastore.TokenStore
import com.ledger.app.data.remote.api.AuthApi
import com.ledger.app.data.remote.api.dto.RefreshRequest
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore,
    private val authEventBus: AuthEventBus,
    private val authApi: AuthApi, // uses unauthenticated client — no circular dep
) : Interceptor {

    @Volatile private var isRefreshing = false

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { tokenStore.getAccessToken() }
        val request = chain.request().newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .build()
        var response = chain.proceed(request)

        if (response.code == 401 && !chain.request().url.encodedPath.contains("/api/auth/")) {
            val refreshed = synchronized(this) {
                if (!isRefreshing) {
                    isRefreshing = true
                    try {
                        val refreshToken = runBlocking { tokenStore.getRefreshToken() }
                        if (refreshToken != null) {
                            val newTokens = runBlocking {
                                authApi.refresh(RefreshRequest(refreshToken))
                            }
                            runBlocking { tokenStore.saveTokens(newTokens.access_token, newTokens.refresh_token) }
                            true
                        } else {
                            false
                        }
                    } catch (e: Exception) {
                        false
                    } finally {
                        isRefreshing = false
                    }
                } else {
                    false
                }
            }
            if (refreshed) {
                val newToken = runBlocking { tokenStore.getAccessToken() }
                response.close()
                response = chain.proceed(
                    chain.request().newBuilder()
                        .addHeader("Authorization", "Bearer $newToken")
                        .build()
                )
            } else {
                runBlocking { tokenStore.clearTokens() }
                authEventBus.tryEmit(AuthEvent.SessionExpired)
            }
        }
        return response
    }
}
