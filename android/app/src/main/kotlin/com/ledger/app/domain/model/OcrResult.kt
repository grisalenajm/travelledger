package com.ledger.app.domain.model

import java.time.LocalDate

data class OcrResult(
    val expenseId: String,
    val paperlessDocId: Int?,
    val date: LocalDate?,
    val amount: Double?,
    val currency: String?,
    val category: ExpenseCategory?,
    val description: String?,
)
