package com.ledger.app.domain.usecase.expense

import com.ledger.app.data.repository.ExpenseRepository
import javax.inject.Inject

class DeleteExpenseUseCase @Inject constructor(
    private val expenseRepository: ExpenseRepository,
) {
    suspend operator fun invoke(id: String): Result<Unit> =
        expenseRepository.delete(id)
}
