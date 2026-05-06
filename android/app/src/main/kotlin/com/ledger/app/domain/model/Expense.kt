package com.ledger.app.domain.model

import java.time.LocalDate

data class Expense(
    val id: String,
    val tripId: String,
    val amount: Double,
    val currency: String,
    val amountBase: Double,
    val rateDate: LocalDate,
    val category: ExpenseCategory,
    val description: String?,
    val date: LocalDate,
    val billable: Boolean,
    val loyaltyCardId: String?,
    val paperlessDocId: Int?,
    val isDraft: Boolean = false,
)

enum class ExpenseCategory {
    Dining, Lodging, Transport, Culture, Shopping, Health, Other;

    fun emoji(): String = when (this) {
        Dining -> "🍽️"
        Lodging -> "🏨"
        Transport -> "🚇"
        Culture -> "🎭"
        Shopping -> "🛍️"
        Health -> "💊"
        Other -> "📦"
    }

    fun displayName(): String = when (this) {
        Dining -> "Dining"
        Lodging -> "Lodge"
        Transport -> "Trans"
        Culture -> "Cult"
        Shopping -> "Shop"
        Health -> "Health"
        Other -> "Other"
    }
}
