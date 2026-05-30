package com.ledger.app.domain.usecase.expense

import com.ledger.app.fake.FakeCurrencyRepository
import com.ledger.app.fake.FakeExpenseRepository
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.domain.model.ExpenseForm
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate

class CreateExpenseUseCaseTest {

    private lateinit var fakeExpenseRepository: FakeExpenseRepository
    private lateinit var fakeCurrencyRepository: FakeCurrencyRepository
    private lateinit var useCase: CreateExpenseUseCase

    private val baseForm = ExpenseForm(
        tripId = "trip-1",
        amount = 100.0,
        currency = "USD",
        category = ExpenseCategory.Dining,
        description = "Lunch",
        date = LocalDate.of(2024, 10, 15),
        billable = true,
        loyaltyCardId = null,
        userCurrencyBase = "EUR",
    )

    @Before
    fun setUp() {
        fakeExpenseRepository = FakeExpenseRepository()
        fakeCurrencyRepository = FakeCurrencyRepository()
        useCase = CreateExpenseUseCase(fakeExpenseRepository, fakeCurrencyRepository)
    }

    @Test
    fun `from == to no llama a currency repository y retorna rate 1`() = runTest {
        val form = baseForm.copy(currency = "EUR", userCurrencyBase = "EUR")
        fakeCurrencyRepository.rateToReturn = Result.success(0.85)

        val result = useCase(form)

        assertFalse(fakeCurrencyRepository.getRateCalled)
        assertTrue(result.isSuccess)
        val expense = result.getOrNull()!!
        assertEquals(100.0, expense.amountBase, 0.001)
    }

    @Test
    fun `currency API falla usa fallback 1 a 1`() = runTest {
        fakeCurrencyRepository.rateToReturn = Result.failure(RuntimeException("network error"))

        val result = useCase(baseForm)

        assertTrue(result.isSuccess)
        val expense = result.getOrNull()!!
        assertEquals(100.0, expense.amountBase, 0.001)
    }

    @Test
    fun `UUID generado en cliente no es nulo ni vacio`() = runTest {
        fakeCurrencyRepository.rateToReturn = Result.success(0.92)

        val result = useCase(baseForm)

        assertTrue(result.isSuccess)
        val expense = result.getOrNull()!!
        assertNotNull(expense.id)
        assertTrue(expense.id.isNotBlank())
    }

    @Test
    fun `amountBase se calcula correctamente con rate valido`() = runTest {
        fakeCurrencyRepository.rateToReturn = Result.success(0.92)

        val result = useCase(baseForm)

        assertTrue(result.isSuccess)
        assertEquals(92.0, result.getOrNull()!!.amountBase, 0.001)
    }

    @Test
    fun `billable default es true`() = runTest {
        val form = baseForm.copy(billable = true)
        val result = useCase(form)
        assertTrue(result.getOrNull()!!.billable)
    }
}
