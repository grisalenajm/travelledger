package com.ledger.app.data.local.room.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "trips")
data class TripEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String?,
    val destination: String,
    val startDate: String,
    val endDate: String,
    val primaryCurrency: String,
    val budget: Double,
    val budgetCurrency: String,
    val status: String,
    val syncPending: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
