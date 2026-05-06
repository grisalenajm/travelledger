package com.ledger.app.presentation.screen.summary

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import com.ledger.app.domain.model.Expense
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.domain.model.Trip
import com.ledger.app.domain.model.TripStatus
import com.ledger.app.domain.usecase.export.ExportCsvUseCase
import com.ledger.app.fake.FakeExportRepository
import com.ledger.app.fake.FakeExpenseRepository
import com.ledger.app.fake.FakeTripRepository
import com.ledger.app.util.FileShareUtil
import com.ledger.app.util.MainCoroutineRule
import com.ledger.app.util.NetworkMonitor
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class SummaryViewModelTest {

    @get:Rule
    val coroutineRule = MainCoroutineRule()

    private lateinit var fakeTripRepository: FakeTripRepository
    private lateinit var fakeExpenseRepository: FakeExpenseRepository
    private lateinit var fakeExportRepository: FakeExportRepository
    private lateinit var mockNetworkMonitor: NetworkMonitor
    private lateinit var mockFileShareUtil: FileShareUtil

    private val testTripId = "trip-abc"

    private val testTrip = Trip(
        id = testTripId,
        name = "Tokyo Test",
        description = null,
        destination = "Tokyo",
        startDate = LocalDate.of(2024, 10, 12),
        endDate = LocalDate.of(2024, 10, 19),
        primaryCurrency = "JPY",
        budget = 5000.0,
        budgetCurrency = "CHF",
        status = TripStatus.active,
    )

    @Before
    fun setUp() {
        fakeTripRepository = FakeTripRepository()
        fakeExpenseRepository = FakeExpenseRepository()
        fakeExportRepository = FakeExportRepository()
        mockNetworkMonitor = mockk()
        mockFileShareUtil = mockk(relaxed = true)
        every { mockNetworkMonitor.isOnline } returns flowOf(true)
        fakeTripRepository.setTrips(listOf(testTrip))
    }

    private fun buildViewModel(isOnline: Boolean = true): SummaryViewModel {
        every { mockNetworkMonitor.isOnline } returns flowOf(isOnline)
        val exportCsvUseCase = ExportCsvUseCase(fakeExportRepository, mockFileShareUtil)
        return SummaryViewModel(
            savedStateHandle = SavedStateHandle(mapOf("tripId" to testTripId)),
            tripRepository = fakeTripRepository,
            expenseRepository = fakeExpenseRepository,
            exportCsvUseCase = exportCsvUseCase,
            networkMonitor = mockNetworkMonitor,
        )
    }

    private fun makeExpense(
        id: String,
        category: ExpenseCategory,
        amount: Double,
        currency: String = "JPY",
        amountBase: Double,
        billable: Boolean = true,
    ) = Expense(
        id = id,
        tripId = testTripId,
        amount = amount,
        currency = currency,
        amountBase = amountBase,
        rateDate = LocalDate.of(2024, 10, 14),
        category = category,
        description = null,
        date = LocalDate.of(2024, 10, 14),
        billable = billable,
        loyaltyCardId = null,
        paperlessDocId = null,
    )

    @Test
    fun `totals are calculated from room offline`() = runTest {
        fakeExpenseRepository.setExpenses(
            listOf(
                makeExpense("e1", ExpenseCategory.Dining, 12000.0, amountBase = 78.0),
                makeExpense("e2", ExpenseCategory.Lodging, 18000.0, amountBase = 116.0),
            )
        )
        val viewModel = buildViewModel(isOnline = false)
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(194.0, state.totalBase, 0.01)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `byCategory is sorted by amountBase descending`() = runTest {
        fakeExpenseRepository.setExpenses(
            listOf(
                makeExpense("e1", ExpenseCategory.Dining, 5000.0, amountBase = 30.0),
                makeExpense("e2", ExpenseCategory.Lodging, 20000.0, amountBase = 120.0),
                makeExpense("e3", ExpenseCategory.Transport, 3000.0, amountBase = 20.0),
            )
        )
        val viewModel = buildViewModel()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(ExpenseCategory.Lodging, state.byCategory[0].category)
            assertEquals(ExpenseCategory.Dining, state.byCategory[1].category)
            assertEquals(ExpenseCategory.Transport, state.byCategory[2].category)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `billable split is calculated correctly`() = runTest {
        fakeExpenseRepository.setExpenses(
            listOf(
                makeExpense("e1", ExpenseCategory.Dining, 10000.0, amountBase = 60.0, billable = true),
                makeExpense("e2", ExpenseCategory.Shopping, 5000.0, amountBase = 30.0, billable = false),
                makeExpense("e3", ExpenseCategory.Lodging, 20000.0, amountBase = 120.0, billable = true),
            )
        )
        val viewModel = buildViewModel()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(180.0, state.totalBillable, 0.01)
            assertEquals(30.0, state.totalPersonal, 0.01)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `exportCsv does nothing when offline`() = runTest {
        fakeExpenseRepository.setExpenses(
            listOf(makeExpense("e1", ExpenseCategory.Dining, 1000.0, amountBase = 10.0))
        )
        val viewModel = buildViewModel(isOnline = false)
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.exportCsv()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.uiState.test {
            val state = awaitItem()
            assertNull(fakeExportRepository.lastDownloadedTripId)
            assertTrue(!state.isExporting)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `exportCsv calls repository when online`() = runTest {
        fakeExpenseRepository.setExpenses(
            listOf(makeExpense("e1", ExpenseCategory.Dining, 1000.0, amountBase = 10.0))
        )
        val viewModel = buildViewModel(isOnline = true)
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.exportCsv()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(testTripId, fakeExportRepository.lastDownloadedTripId)
    }
}
