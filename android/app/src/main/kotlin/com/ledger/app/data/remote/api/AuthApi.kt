package com.ledger.app.data.remote.api

import com.ledger.app.data.remote.api.dto.LoginRequest
import com.ledger.app.data.remote.api.dto.RefreshRequest
import com.ledger.app.data.remote.api.dto.RegisterRequest
import com.ledger.app.data.remote.api.dto.TokenResponse
import com.ledger.app.data.remote.api.dto.UserDto
import com.ledger.app.data.remote.api.dto.ValidateInviteRequest
import com.ledger.app.data.remote.api.dto.ValidateInviteResponse
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): TokenResponse

    @POST("api/auth/register")
    suspend fun register(@Body body: RegisterRequest): UserDto

    @POST("api/auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): TokenResponse

    @POST("api/auth/logout")
    suspend fun logout()

    @POST("api/auth/validate-invite")
    suspend fun validateInvite(@Body body: ValidateInviteRequest): ValidateInviteResponse
}
