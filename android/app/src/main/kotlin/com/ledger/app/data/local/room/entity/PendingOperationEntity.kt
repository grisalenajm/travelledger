package com.ledger.app.data.local.room.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_operations")
data class PendingOperationEntity(
    @PrimaryKey val operationId: String,
    val type: String,
    val payload: String,
    val imagePath: String? = null,
    val createdAt: Long,
    val attempts: Int = 0,
    val lastAttemptAt: Long? = null,
    val lastError: String? = null,
    val status: String = "pending",
)
