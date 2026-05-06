package com.ledger.app.presentation.screen.expense.detail

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import com.ledger.app.data.local.datastore.ConfigStore
import com.ledger.app.domain.model.Expense
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.domain.model.Trip
import com.ledger.app.domain.model.TripStatus
import com.ledger.app.domain.usecase.expense.DeleteExpenseUseCase
import com.ledger.app.domain.usecase.expense.UpdateExpenseUseCase
import com.ledger.app.fake.FakeCurrencyRepository
import com.ledger.app.fake.FakeExpenseRepository
import com.ledger.app.fake.FakeTripRepository
import com.ledger.app.util.MainCoroutineRule
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class ExpenseDetailViewModelTest {

    @get:Rule
    val coroutineRule = MainCoroutineRule()

    private lateinit var expenseRepo: FakeExpenseRepository
    private lateinit var tripRepo: FakeTripRepository
    private lateinit var currencyRepo: FakeCurrencyRepository
    private lateinit var configStore: ConfigStore

    private val testExpenseId = "expense-1"
    private val testTripId = "trip-1"

    @Before
    fun setUp() {
        expenseRepo = FakeExpenseRepository()
        tripRepo = FakeTripRepository()
        currencyRepo = FakeCurrencyRepository()
        configStore = mockk(relaxed = true)
        coEvery { configStore.getServerUrl() } returns "http://192.168.1.125:8000"

        tripRepo.setTrips(listOf(fakeTrip()))
    }

    private fun buildViewModel(
        expenseId: String = testExpenseId,
        isOcrDraft: Boolean = false,
    ): ExpenseDetailViewModel {
        val updateUseCase = UpdateExpenseUseCase(expenseRepo, currencyRepo)
        val deleteUseCase = DeleteExpenseUseCase(expenseRepo)
        return ExpenseDetailViewModel(
            savedStateHandle = SavedStateHandle(
                mapOf("expenseId" to expenseId, "isOcrDraft" to isOcrDraft),
            ),
            expenseRepository = expenseRepo,
            tripRepository = tripRepo,
            updateExpenseUseCase = updateUseCase,
            deleteExpenseUseCase = deleteUseCase,
            configStore = configStore,
        )
    }

    @Test
    fun `test_load_expense_from_room`() = runTest {
        expenseRepo.setExpenses(listOf(fakeExpense()))

        val viewModel = buildViewModel()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.expense)
        assertEquals(testExpenseId, state.expense?.id)
        assertFalse(state.isLoading)
    }

    @Test
    fun `test_update_expense_marks_syncPending`() = runTest {
        expenseRepo.setExpenses(listOf(fakeExpense()))
        currencyRepo.rateToReturn = Result.success(1.1)

        val viewModel = buildViewModel()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.toggleEdit()
        viewModel.onEditAmount("99.00")
        viewModel.onEditCurrency("USD")
        viewModel.onEditCategory(ExpenseCategory.Shopping)
        viewModel.onSave()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        val updated = expenseRepo.lastUpdated
        assertNotNull(updated)
        assertEquals(99.00, updated?.amount)
        assertEquals("USD", updated?.currency)
        assertEquals(ExpenseCategory.Shopping, updated?.category)
    }

    @Test
    fun `test_delete_expense_emits_navigateBack`() = runTest {
        expenseRepo.setExpenses(listOf(fakeExpense()))

        val viewModel = buildViewModel()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.events.test {
            viewModel.confirmDelete()
            coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

            val event = awaitItem()
            assertTrue(event is ExpenseDetailEvent.NavigateBack)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `test_ocr_draft_banner_visible_when_isOcrDraft_true`() = runTest {
        expenseRepo.setExpenses(listOf(fakeExpense()))

        val viewModel = buildViewModel(isOcrDraft = true)
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(viewModel.uiState.value.isOcrDraft)
    }

    @Test
    fun `test_update_clears_draft_flag`() = runTest {
        expenseRepo.setExpenses(listOf(fakeExpense(isDraft = true)))

        val viewModel = buildViewModel(isOcrDraft = true)
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(viewModel.uiState.value.isOcrDraft)

        viewModel.toggleEdit()
        viewModel.onEditAmount("50.00")
        viewModel.onEditCategory(ExpenseCategory.Dining)
        viewModel.onSave()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        assertFalse(viewModel.uiState.value.isOcrDraft)
        assertFalse(viewModel.uiState.value.expense?.isDraft ?: true)
    }

    private fun fakeExpense(isDraft: Boolean = false) = Expense(
        id = testExpenseId,
        tripId = testTripId,
        amount = 42.0,
        currency = "EUR",
        amountBase = 42.0,
        rateDate = LocalDate.of(2024, 10, 14),
        category = ExpenseCategory.Dining,
        description = "Test expense",
        date = LocalDate.of(2024, 10, 14),
        billable = true,
        loyaltyCardId = null,
        paperlessDocId = null,
        isDraft = isDraft,
    )

    private fun fakeTrip() = Trip(
        id = testTripId,
        name = "Test Trip",
        description = null,
        destination = "Paris",
        startDate = LocalDate.of(2024, 10, 1),
        endDate = LocalDate.of(2024, 10, 31),
        primaryCurrency = "EUR",
        budget = 1000.0,
        budgetCurrency = "EUR",
        status = TripStatus.active,
    )
}
