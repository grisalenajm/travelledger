package com.ledger.app.presentation.screen.summary

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.data.repository.ExpenseRepository
import com.ledger.app.data.repository.TripRepository
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.domain.model.Trip
import com.ledger.app.domain.usecase.export.ExportCsvUseCase
import com.ledger.app.util.NetworkMonitor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CategoryTotal(
    val category: ExpenseCategory,
    val amountBase: Double,
    val percentage: Float,
    val count: Int,
)

data class CurrencyTotal(
    val currency: String,
    val amount: Double,
    val amountBase: Double,
)

data class SummaryUiState(
    val trip: Trip? = null,
    val totalBase: Double = 0.0,
    val totalBillable: Double = 0.0,
    val totalPersonal: Double = 0.0,
    val byCategory: List<CategoryTotal> = emptyList(),
    val byCurrency: List<CurrencyTotal> = emptyList(),
    val baseCurrency: String = "",
    val isOnline: Boolean = false,
    val isExporting: Boolean = false,
    val exportError: String? = null,
)

@HiltViewModel
class SummaryViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val tripRepository: TripRepository,
    private val expenseRepository: ExpenseRepository,
    private val exportCsvUseCase: ExportCsvUseCase,
    private val networkMonitor: NetworkMonitor,
) : ViewModel() {

    private val tripId: String = checkNotNull(savedStateHandle["tripId"])

    private val _uiState = MutableStateFlow(SummaryUiState())
    val uiState: StateFlow<SummaryUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            combine(
                tripRepository.getTrips(),
                expenseRepository.getExpensesByTrip(tripId),
                networkMonitor.isOnline,
            ) { trips, expenses, online ->
                val trip = trips.find { it.id == tripId }
                val totalBase = expenses.sumOf { it.amountBase }
                val totalBillable = expenses.filter { it.billable }.sumOf { it.amountBase }
                val totalPersonal = expenses.filter { !it.billable }.sumOf { it.amountBase }

                val byCategory = expenses
                    .groupBy { it.category }
                    .map { (cat, list) ->
                        CategoryTotal(
                            category = cat,
                            amountBase = list.sumOf { it.amountBase },
                            percentage = if (totalBase > 0) (list.sumOf { it.amountBase } / totalBase).toFloat() else 0f,
                            count = list.size,
                        )
                    }
                    .sortedByDescending { it.amountBase }

                val byCurrency = expenses
                    .groupBy { it.currency }
                    .map { (currency, list) ->
                        CurrencyTotal(
                            currency = currency,
                            amount = list.sumOf { it.amount },
                            amountBase = list.sumOf { it.amountBase },
                        )
                    }
                    .sortedByDescending { it.amountBase }

                Triple(
                    SummaryUiState(
                        trip = trip,
                        totalBase = totalBase,
                        totalBillable = totalBillable,
                        totalPersonal = totalPersonal,
                        byCategory = byCategory,
                        byCurrency = byCurrency,
                        baseCurrency = trip?.budgetCurrency ?: "",
                        isOnline = online,
                    ),
                    Unit, Unit
                )
            }.collect { (newState, _, _) ->
                _uiState.update { current ->
                    newState.copy(
                        isExporting = current.isExporting,
                        exportError = current.exportError,
                    )
                }
            }
        }
    }

    fun exportCsv() {
        val state = _uiState.value
        if (!state.isOnline || state.isExporting) return
        val tripName = state.trip?.name ?: return
        _uiState.update { it.copy(isExporting = true, exportError = null) }
        viewModelScope.launch {
            val result = exportCsvUseCase(tripId, tripName)
            _uiState.update {
                it.copy(
                    isExporting = false,
                    exportError = if (result.isFailure) "Error al exportar" else null,
                )
            }
        }
    }
}
