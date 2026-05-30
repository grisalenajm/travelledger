package com.ledger.app.domain.usecase.expense

import com.ledger.app.data.repository.CurrencyRepository
import com.ledger.app.data.repository.ExpenseRepository
import com.ledger.app.domain.model.Expense
import com.ledger.app.domain.model.ExpenseForm
import com.ledger.app.util.UuidGenerator
import javax.inject.Inject

class CreateExpenseUseCase @Inject constructor(
    private val expenseRepository: ExpenseRepository,
    private val currencyRepository: CurrencyRepository,
) {
    suspend operator fun invoke(form: ExpenseForm): Result<Expense> {
        val rate = currencyRepository.getRate(
            form.currency,
            form.userCurrencyBase,
            form.date,
        ).getOrElse { 1.0 }

        val expense = Expense(
            id = UuidGenerator.generate(),
            tripId = form.tripId,
            amount = form.amount,
            currency = form.currency,
            amountBase = form.amount * rate,
            rateDate = form.date,
            category = form.category,
            description = form.description,
            date = form.date,
            billable = form.billable,
            loyaltyCardId = form.loyaltyCardId,
            paperlessDocId = null,
        )
        return expenseRepository.create(expense)
    }
}
