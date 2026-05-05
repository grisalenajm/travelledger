package com.ledger.app.presentation.screen.expense.capture

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.domain.model.TripStatus
import com.ledger.app.domain.usecase.expense.CreateExpenseUseCase
import com.ledger.app.fake.FakeCurrencyRepository
import com.ledger.app.fake.FakeExpenseRepository
import com.ledger.app.fake.FakeTripRepository
import com.ledger.app.util.MainCoroutineRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class QuickCaptureViewModelTest {

    @get:Rule
    val coroutineRule = MainCoroutineRule()

    private lateinit var fakeTripRepository: FakeTripRepository
    private lateinit var fakeCurrencyRepository: FakeCurrencyRepository
    private lateinit var fakeExpenseRepository: FakeExpenseRepository
    private lateinit var createExpenseUseCase: CreateExpenseUseCase
    private lateinit var viewModel: QuickCaptureViewModel

    private val testTripId = "trip-abc"

    @Before
    fun setUp() {
        fakeTripRepository = FakeTripRepository()
        fakeCurrencyRepository = FakeCurrencyRepository()
        fakeExpenseRepository = FakeExpenseRepository()
        createExpenseUseCase = CreateExpenseUseCase(fakeExpenseRepository, fakeCurrencyRepository)

        fakeTripRepository.setTrips(listOf(fakeTrip()))

        val savedState = SavedStateHandle(mapOf("tripId" to testTripId, "day" to "2024-10-15"))
        viewModel = QuickCaptureViewModel(
            savedState,
            fakeTripRepository,
            fakeCurrencyRepository,
            createExpenseUseCase,
        )
    }

    @Test
    fun `amount 0 - guardar no actualiza savedExpenseId`() = runTest {
        viewModel.onAmountChange("0")
        viewModel.onCategoryChange(ExpenseCategory.Dining)

        viewModel.uiState.test {
            val state = awaitItem()
            viewModel.onSave()
            val after = awaitItem()
            assertNull(after.savedExpenseId)
            assertFalse(after.isSaving)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `category null - no llama al usecase`() = runTest {
        viewModel.onAmountChange("50")

        viewModel.uiState.test {
            awaitItem()
            viewModel.onSave()
            val after = awaitItem()
            assertNull(after.savedExpenseId)
            assertNull(fakeExpenseRepository.lastCreated)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `guardar exitoso - savedExpenseId no es null`() = runTest {
        viewModel.onAmountChange("50")
        viewModel.onCategoryChange(ExpenseCategory.Dining)

        viewModel.uiState.test {
            awaitItem()
            viewModel.onSave()
            val saved = awaitItem()
            assertNotNull(saved.savedExpenseId)
            assertFalse(saved.isSaving)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `UUID generado en cliente - CreateExpenseUseCase recibe expense con id`() = runTest {
        viewModel.onAmountChange("50")
        viewModel.onCategoryChange(ExpenseCategory.Dining)
        viewModel.onSave()

        // Allow coroutine to complete
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        val created = fakeExpenseRepository.lastCreated
        assertNotNull(created)
        assertTrue(created!!.id.isNotBlank())
    }

    @Test
    fun `billable default es true`() = runTest {
        viewModel.uiState.test {
            val state = awaitItem()
            assertTrue(state.billable)
            cancelAndIgnoreRemainingEvents()
        }
    }

    private fun fakeTrip() = com.ledger.app.domain.model.Trip(
        id = testTripId,
        name = "Tokyo Trip",
        description = null,
        destination = "Tokyo",
        startDate = LocalDate.of(2024, 10, 12),
        endDate = LocalDate.of(2024, 10, 20),
        primaryCurrency = "JPY",
        budget = 5000.0,
        budgetCurrency = "CHF",
        status = TripStatus.active,
    )
}
