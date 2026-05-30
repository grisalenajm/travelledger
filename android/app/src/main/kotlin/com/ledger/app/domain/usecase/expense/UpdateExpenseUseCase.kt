package com.ledger.app.domain.usecase.expense

import com.ledger.app.data.repository.CurrencyRepository
import com.ledger.app.data.repository.ExpenseRepository
import com.ledger.app.domain.model.Expense
import javax.inject.Inject

class UpdateExpenseUseCase @Inject constructor(
    private val expenseRepository: ExpenseRepository,
    private val currencyRepository: CurrencyRepository,
) {
    suspend operator fun invoke(expense: Expense, userCurrencyBase: String): Result<Expense> {
        val rate = currencyRepository.getRate(
            expense.currency,
            userCurrencyBase,
            expense.date,
        ).getOrElse { 1.0 }

        val updated = expense.copy(
            amountBase = expense.amount * rate,
            rateDate = expense.date,
            isDraft = false,
        )
        return expenseRepository.update(updated)
    }
}
