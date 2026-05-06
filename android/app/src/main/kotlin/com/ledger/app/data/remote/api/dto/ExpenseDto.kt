package com.ledger.app.data.remote.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class ExpenseDto(
    val id: String,
    val trip_id: String,
    val amount: Double,
    val currency: String,
    val amount_base: Double,
    val rate_date: String,
    val category: String,
    val description: String?,
    val date: String,
    val billable: Boolean,
    val loyalty_card_id: String?,
    val paperless_doc_id: Int?,
    val is_draft: Boolean = false,
    val created_at: String,
    val updated_at: String,
)

@Serializable
data class ExpenseCreateDto(
    val id: String? = null,
    val trip_id: String,
    val amount: Double,
    val currency: String,
    val category: String,
    val description: String? = null,
    val date: String,
    val billable: Boolean = true,
    val loyalty_card_id: String? = null,
)
