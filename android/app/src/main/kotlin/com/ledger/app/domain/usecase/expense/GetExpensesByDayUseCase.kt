package com.ledger.app.domain.usecase.expense

import com.ledger.app.data.repository.ExpenseRepository
import com.ledger.app.domain.model.Expense
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate
import javax.inject.Inject

class GetExpensesByDayUseCase @Inject constructor(
    private val expenseRepository: ExpenseRepository,
) {
    operator fun invoke(tripId: String, date: LocalDate): Flow<List<Expense>> =
        expenseRepository.getExpensesByDay(tripId, date)
}
