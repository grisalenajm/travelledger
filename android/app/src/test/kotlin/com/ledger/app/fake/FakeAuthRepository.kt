package com.ledger.app.fake

import com.ledger.app.data.repository.AuthRepository

class FakeAuthRepository : AuthRepository {
    var loginResult: Result<Unit> = Result.success(Unit)
    var registerResult: Result<Unit> = Result.success(Unit)
    var logoutResult: Result<Unit> = Result.success(Unit)
    var refreshResult: Result<Unit> = Result.success(Unit)
    var tokensCleared = false
    var loginCalledWith: Pair<String, String>? = null
    var registerCalledWith: Quad? = null

    override suspend fun login(email: String, password: String): Result<Unit> {
        loginCalledWith = Pair(email, password)
        return loginResult
    }

    override suspend fun register(
        name: String,
        email: String,
        password: String,
        currencyBase: String,
    ): Result<Unit> {
        registerCalledWith = Quad(name, email, password, currencyBase)
        return registerResult
    }

    override suspend fun logout(): Result<Unit> = logoutResult

    override suspend fun refreshToken(): Result<Unit> = refreshResult

    override suspend fun clearTokens() {
        tokensCleared = true
    }

    data class Quad(
        val name: String,
        val email: String,
        val password: String,
        val currencyBase: String,
    )
}
