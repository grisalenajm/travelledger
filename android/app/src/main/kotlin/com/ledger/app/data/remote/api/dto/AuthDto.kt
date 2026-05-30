package com.ledger.app.data.remote.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class RegisterRequest(
    val name: String,
    val email: String,
    val password: String,
    val currency_base: String,
    val invite_code: String,
)

@Serializable
data class RefreshRequest(
    val refresh_token: String,
)

@Serializable
data class ValidateInviteRequest(
    val code: String,
)

@Serializable
data class TokenResponse(
    val access_token: String,
    val refresh_token: String,
    val token_type: String = "bearer",
)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val name: String,
    val currency_base: String,
    val telegram_chat_id: String? = null,
)

@Serializable
data class ValidateInviteResponse(
    val valid: Boolean,
)
