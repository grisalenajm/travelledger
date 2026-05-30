package com.ledger.app.data.repository

import com.ledger.app.data.local.datastore.ConfigStore
import com.ledger.app.data.local.datastore.TokenStore
import com.ledger.app.data.remote.api.AuthApi
import com.ledger.app.data.remote.api.dto.LoginRequest
import com.ledger.app.data.remote.api.dto.RefreshRequest
import com.ledger.app.data.remote.api.dto.RegisterRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val tokenStore: TokenStore,
    private val configStore: ConfigStore,
) : AuthRepository {

    override suspend fun login(email: String, password: String): Result<Unit> = runCatching {
        val tokens = withContext(Dispatchers.IO) {
            authApi.login(LoginRequest(email, password))
        }
        tokenStore.saveTokens(tokens.access_token, tokens.refresh_token)
        configStore.saveLastEmail(email)
    }

    override suspend fun register(
        name: String,
        email: String,
        password: String,
        currencyBase: String,
    ): Result<Unit> = runCatching {
        val inviteCode = configStore.getInviteCode()
            ?: throw IllegalStateException("Invite code not configured")
        withContext(Dispatchers.IO) {
            authApi.register(RegisterRequest(name, email, password, currencyBase, inviteCode))
        }
        Unit
    }

    override suspend fun logout(): Result<Unit> = runCatching {
        // Backend logout is stateless (JWT — server discards nothing). Best-effort call; always clear local tokens.
        runCatching { withContext(Dispatchers.IO) { authApi.logout() } }
        tokenStore.clearTokens()
    }

    override suspend fun refreshToken(): Result<Unit> = runCatching {
        val refreshToken = tokenStore.getRefreshToken()
            ?: throw IllegalStateException("No refresh token")
        val tokens = withContext(Dispatchers.IO) {
            authApi.refresh(RefreshRequest(refreshToken))
        }
        tokenStore.saveTokens(tokens.access_token, tokens.refresh_token)
    }

    override suspend fun clearTokens() = tokenStore.clearTokens()
}
