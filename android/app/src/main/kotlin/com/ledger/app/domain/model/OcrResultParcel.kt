package com.ledger.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class OcrResultParcel(
    val expenseId: String,
    val paperlessDocId: Int?,
    val date: String?,
    val amount: Double?,
    val currency: String?,
    val category: String?,
    val description: String?,
)

fun OcrResult.toParcel() = OcrResultParcel(
    expenseId = expenseId,
    paperlessDocId = paperlessDocId,
    date = date?.toString(),
    amount = amount,
    currency = currency,
    category = category?.name,
    description = description,
)
