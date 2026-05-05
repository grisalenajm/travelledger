package com.ledger.app.fake

import com.ledger.app.data.repository.ExpenseRepository
import com.ledger.app.domain.model.Expense
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import java.time.LocalDate

class FakeExpenseRepository : ExpenseRepository {

    private val _expenses = MutableStateFlow<List<Expense>>(emptyList())

    var createResult: Result<Expense>? = null
    var deleteResult: Result<Unit> = Result.success(Unit)
    var lastCreated: Expense? = null

    fun setExpenses(expenses: List<Expense>) {
        _expenses.value = expenses
    }

    override fun getExpensesByDay(tripId: String, date: LocalDate): Flow<List<Expense>> =
        _expenses.map { list -> list.filter { it.tripId == tripId && it.date == date } }

    override fun getExpensesByTrip(tripId: String): Flow<List<Expense>> =
        _expenses.map { list -> list.filter { it.tripId == tripId } }

    override suspend fun create(expense: Expense): Result<Expense> {
        lastCreated = expense
        val result = createResult ?: Result.success(expense)
        if (result.isSuccess) _expenses.value = _expenses.value + expense
        return result
    }

    override suspend fun delete(id: String): Result<Unit> {
        if (deleteResult.isSuccess) _expenses.value = _expenses.value.filterNot { it.id == id }
        return deleteResult
    }

    override suspend fun syncFromServer(tripId: String): Result<Unit> = Result.success(Unit)
}
