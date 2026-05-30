package com.ledger.app.domain.model

import java.time.LocalDate

data class Trip(
    val id: String,
    val name: String,
    val description: String?,
    val destination: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val primaryCurrency: String,
    val budget: Double,
    val budgetCurrency: String,
    val status: TripStatus,
)

enum class TripStatus { active, closed, draft }
