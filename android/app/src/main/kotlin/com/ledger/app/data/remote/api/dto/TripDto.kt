package com.ledger.app.data.remote.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class TripDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val destination: String,
    val start_date: String,
    val end_date: String,
    val primary_currency: String,
    val budget: Double,
    val budget_currency: String,
    val status: String,
    val created_at: String,
    val updated_at: String,
)

@Serializable
data class TripCreateDto(
    val id: String? = null,
    val name: String,
    val description: String? = null,
    val destination: String,
    val start_date: String,
    val end_date: String,
    val primary_currency: String,
    val budget: Double = 0.0,
    val budget_currency: String,
    val status: String = "active",
)

@Serializable
data class TripSummaryDto(
    val spent_base: Double,
    val budget_base: Double,
    val currency_base: String,
    val percentage: Double,
    val expense_count: Int,
    val legs_count: Int,
)
