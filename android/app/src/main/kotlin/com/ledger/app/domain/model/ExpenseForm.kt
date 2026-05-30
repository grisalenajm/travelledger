package com.ledger.app.domain.model

import java.time.LocalDate

data class ExpenseForm(
    val tripId: String,
    val amount: Double,
    val currency: String,
    val category: ExpenseCategory,
    val description: String?,
    val date: LocalDate,
    val billable: Boolean,
    val loyaltyCardId: String?,
    val userCurrencyBase: String,
)
