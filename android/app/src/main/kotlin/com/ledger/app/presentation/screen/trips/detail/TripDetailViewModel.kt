package com.ledger.app.presentation.screen.trips.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.data.repository.ExpenseRepository
import com.ledger.app.data.repository.TripRepository
import com.ledger.app.domain.model.Expense
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.domain.model.Trip
import com.ledger.app.domain.usecase.expense.DeleteExpenseUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import javax.inject.Inject

data class TripDetailUiState(
    val trip: Trip? = null,
    val selectedDay: LocalDate = LocalDate.now(),
    val days: List<LocalDate> = emptyList(),
    val expensesForDay: List<Expense> = emptyList(),
    val totalForDay: Double = 0.0,
    val currencyBase: String = "EUR",
    val pendingOpsCount: Int = 0,
    val selectedCategory: ExpenseCategory? = null,
    val pendingDeleteExpense: Expense? = null,
    val isLoading: Boolean = true,
    val error: String? = null,
)

@HiltViewModel
class TripDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val tripRepository: TripRepository,
    private val expenseRepository: ExpenseRepository,
    private val deleteExpenseUseCase: DeleteExpenseUseCase,
) : ViewModel() {

    private val tripId: String = checkNotNull(savedStateHandle["tripId"])

    private val _selectedDay = MutableStateFlow(LocalDate.now())
    private val _selectedCategory = MutableStateFlow<ExpenseCategory?>(null)
    private val _pendingDeleteExpense = MutableStateFlow<Expense?>(null)

    @OptIn(ExperimentalCoroutinesApi::class)
    val uiState: StateFlow<TripDetailUiState> = combine(
        tripRepository.getTrips(),
        tripRepository.observePendingOpsCount(),
        _selectedDay,
    ) { trips, pendingCount, selectedDay ->
        Triple(trips.find { it.id == tripId }, pendingCount, selectedDay)
    }.flatMapLatest { (trip, pendingCount, selectedDay) ->
        if (trip == null) {
            flowOf(TripDetailUiState(isLoading = false, error = "Viaje no encontrado"))
        } else {
            val days = generateDays(trip.startDate, trip.endDate)
            val effectiveDay = if (days.contains(selectedDay)) selectedDay
                               else days.firstOrNull() ?: selectedDay
            combine(
                expenseRepository.getExpensesByDay(tripId, effectiveDay),
                _selectedCategory,
                _pendingDeleteExpense,
            ) { expenses, cat, pendingDelete ->
                val filtered = if (cat == null) expenses else expenses.filter { it.category == cat }
                TripDetailUiState(
                    trip = trip,
                    selectedDay = effectiveDay,
                    days = days,
                    expensesForDay = filtered,
                    totalForDay = expenses.sumOf { it.amountBase },
                    currencyBase = trip.budgetCurrency,
                    pendingOpsCount = pendingCount,
                    selectedCategory = cat,
                    pendingDeleteExpense = pendingDelete,
                    isLoading = false,
                )
            }
        }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = TripDetailUiState(),
    )

    fun selectDay(day: LocalDate) {
        _selectedDay.value = day
    }

    fun selectCategory(cat: ExpenseCategory?) {
        _selectedCategory.value = cat
    }

    fun requestDelete(expense: Expense) {
        _pendingDeleteExpense.value = expense
    }

    fun cancelDelete() {
        _pendingDeleteExpense.value = null
    }

    fun confirmDelete() {
        val expense = _pendingDeleteExpense.value ?: return
        _pendingDeleteExpense.value = null
        viewModelScope.launch {
            deleteExpenseUseCase(expense.id)
        }
    }

    fun refresh() {
        viewModelScope.launch {
            tripRepository.syncFromServer()
            expenseRepository.syncFromServer(tripId)
        }
    }

    private fun generateDays(start: LocalDate, end: LocalDate): List<LocalDate> {
        val count = ChronoUnit.DAYS.between(start, end).toInt() + 1
        return (0 until count).map { start.plusDays(it.toLong()) }
    }
}
