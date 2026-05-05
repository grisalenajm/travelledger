package com.ledger.app.data.local.room.entity

import com.ledger.app.data.remote.api.dto.ExpenseDto
import com.ledger.app.domain.model.Expense
import com.ledger.app.domain.model.ExpenseCategory
import java.time.LocalDate

fun ExpenseEntity.toDomain(): Expense = Expense(
    id = id,
    tripId = tripId,
    amount = amount,
    currency = currency,
    amountBase = amountBase,
    rateDate = LocalDate.parse(rateDate),
    category = runCatching { ExpenseCategory.valueOf(category) }.getOrDefault(ExpenseCategory.Other),
    description = description,
    date = LocalDate.parse(date),
    billable = billable,
    loyaltyCardId = loyaltyCardId,
    paperlessDocId = paperlessDocId,
)

fun Expense.toEntity(syncPending: Boolean = false): ExpenseEntity = ExpenseEntity(
    id = id,
    tripId = tripId,
    amount = amount,
    currency = currency,
    amountBase = amountBase,
    rateDate = rateDate.toString(),
    category = category.name,
    description = description,
    date = date.toString(),
    billable = billable,
    loyaltyCardId = loyaltyCardId,
    paperlessDocId = paperlessDocId,
    syncPending = syncPending,
    updatedAt = System.currentTimeMillis(),
)

fun ExpenseDto.toEntity(): ExpenseEntity = ExpenseEntity(
    id = id,
    tripId = trip_id,
    amount = amount,
    currency = currency,
    amountBase = amount_base,
    rateDate = rate_date,
    category = category,
    description = description,
    date = date,
    billable = billable,
    loyaltyCardId = loyalty_card_id,
    paperlessDocId = paperless_doc_id,
    syncPending = false,
)
