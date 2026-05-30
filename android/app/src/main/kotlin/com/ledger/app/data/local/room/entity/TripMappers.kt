package com.ledger.app.data.local.room.entity

import com.ledger.app.data.remote.api.dto.TripDto
import com.ledger.app.domain.model.Trip
import com.ledger.app.domain.model.TripStatus
import java.time.LocalDate

fun TripEntity.toDomain(): Trip = Trip(
    id = id,
    name = name,
    description = description,
    destination = destination,
    startDate = LocalDate.parse(startDate),
    endDate = LocalDate.parse(endDate),
    primaryCurrency = primaryCurrency,
    budget = budget,
    budgetCurrency = budgetCurrency,
    status = TripStatus.valueOf(status),
)

fun Trip.toEntity(syncPending: Boolean = false): TripEntity = TripEntity(
    id = id,
    name = name,
    description = description,
    destination = destination,
    startDate = startDate.toString(),
    endDate = endDate.toString(),
    primaryCurrency = primaryCurrency,
    budget = budget,
    budgetCurrency = budgetCurrency,
    status = status.name,
    syncPending = syncPending,
    updatedAt = System.currentTimeMillis(),
)

fun TripDto.toEntity(): TripEntity = TripEntity(
    id = id,
    name = name,
    description = description,
    destination = destination,
    startDate = start_date,
    endDate = end_date,
    primaryCurrency = primary_currency,
    budget = budget,
    budgetCurrency = budget_currency,
    status = status,
    syncPending = false,
)

fun TripDto.toDomain(): Trip = Trip(
    id = id,
    name = name,
    description = description,
    destination = destination,
    startDate = LocalDate.parse(start_date),
    endDate = LocalDate.parse(end_date),
    primaryCurrency = primary_currency,
    budget = budget,
    budgetCurrency = budget_currency,
    status = TripStatus.valueOf(status),
)
