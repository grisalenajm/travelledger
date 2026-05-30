package com.ledger.app.data.remote.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class ConvertResponseDto(
    val from: String,
    val to: String,
    val rate: Double,
    val date: String,
    val result: Double,
)
