package com.ledger.app.data.repository

import com.ledger.app.domain.model.Expense
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

interface ExpenseRepository {
    fun getExpensesByDay(tripId: String, date: LocalDate): Flow<List<Expense>>
    fun getExpensesByTrip(tripId: String): Flow<List<Expense>>
    suspend fun getById(id: String): Expense?
    suspend fun fetchById(id: String): Expense?
    suspend fun create(expense: Expense): Result<Expense>
    suspend fun update(expense: Expense): Result<Expense>
    suspend fun delete(id: String): Result<Unit>
    suspend fun syncFromServer(tripId: String): Result<Unit>
}
