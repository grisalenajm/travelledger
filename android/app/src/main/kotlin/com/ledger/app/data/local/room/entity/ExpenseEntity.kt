package com.ledger.app.data.local.room.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "expenses")
data class ExpenseEntity(
    @PrimaryKey val id: String,
    val tripId: String,
    val amount: Double,
    val currency: String,
    val amountBase: Double,
    val rateDate: String,
    val category: String,
    val description: String?,
    val date: String,
    val billable: Boolean = true,
    val loyaltyCardId: String?,
    val paperlessDocId: Int?,
    val syncPending: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
