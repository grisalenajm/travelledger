package com.ledger.app.presentation.screen.expense.capture

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.data.repository.CurrencyRepository
import com.ledger.app.data.repository.TripRepository
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.domain.model.ExpenseForm
import com.ledger.app.domain.usecase.expense.CreateExpenseUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class QuickCaptureUiState(
    val amount: String = "",
    val currency: String = "",
    val category: ExpenseCategory? = null,
    val description: String = "",
    val date: LocalDate = LocalDate.now(),
    val billable: Boolean = true,
    val amountBasePreview: String = "",
    val isConverting: Boolean = false,
    val isSaving: Boolean = false,
    val savedExpenseId: String? = null,
    val error: String? = null,
    val userCurrencyBase: String = "EUR",
    val tripName: String = "",
)

@HiltViewModel
class QuickCaptureViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val tripRepository: TripRepository,
    private val currencyRepository: CurrencyRepository,
    private val createExpenseUseCase: CreateExpenseUseCase,
) : ViewModel() {

    private val tripId: String = checkNotNull(savedStateHandle["tripId"])
    private val dayArg: String? = savedStateHandle["day"]

    private val _uiState = MutableStateFlow(QuickCaptureUiState())
    val uiState: StateFlow<QuickCaptureUiState> = _uiState.asStateFlow()

    private var conversionJob: Job? = null

    init {
        loadTrip()
        observeAmountAndCurrencyChanges()
    }

    private fun loadTrip() {
        viewModelScope.launch {
            tripRepository.getTrips().collect { trips ->
                val trip = trips.find { it.id == tripId } ?: return@collect
                val date = dayArg?.let {
                    runCatching { LocalDate.parse(it) }.getOrNull()
                } ?: LocalDate.now()
                _uiState.update { state ->
                    state.copy(
                        currency = trip.primaryCurrency,
                        tripName = trip.name,
                        date = date,
                    )
                }
            }
        }
    }

    @OptIn(FlowPreview::class)
    private fun observeAmountAndCurrencyChanges() {
        viewModelScope.launch {
            uiState
                .drop(1)
                .debounce(500)
                .distinctUntilChanged { old, new ->
                    old.amount == new.amount && old.currency == new.currency
                }
                .collect { state ->
                    updateConversion(state.amount, state.currency, state.date)
                }
        }
    }

    private fun updateConversion(amount: String, currency: String, date: LocalDate) {
        val amountDouble = amount.toDoubleOrNull() ?: return
        if (amountDouble <= 0) {
            _uiState.update { it.copy(amountBasePreview = "") }
            return
        }
        val userBase = _uiState.value.userCurrencyBase
        if (currency == userBase) {
            _uiState.update {
                it.copy(amountBasePreview = "→ $userBase %.2f".format(amountDouble))
            }
            return
        }
        conversionJob?.cancel()
        conversionJob = viewModelScope.launch {
            _uiState.update { it.copy(isConverting = true) }
            val rate = currencyRepository.getRate(currency, userBase, date).getOrElse { 1.0 }
            val converted = amountDouble * rate
            _uiState.update {
                it.copy(
                    amountBasePreview = "→ $userBase %.2f".format(converted),
                    isConverting = false,
                )
            }
        }
    }

    fun onAmountChange(value: String) {
        _uiState.update { it.copy(amount = value, error = null) }
    }

    fun onCurrencyChange(value: String) {
        _uiState.update { it.copy(currency = value, amountBasePreview = "") }
    }

    fun onCategoryChange(category: ExpenseCategory) {
        _uiState.update { it.copy(category = category) }
    }

    fun onDescriptionChange(value: String) {
        _uiState.update { it.copy(description = value) }
    }

    fun onBillableChange(value: Boolean) {
        _uiState.update { it.copy(billable = value) }
    }

    fun onSave() {
        val state = _uiState.value
        val amount = state.amount.toDoubleOrNull()
        if (amount == null || amount <= 0) {
            _uiState.update { it.copy(error = "Introduce un importe válido") }
            return
        }
        if (state.category == null) {
            _uiState.update { it.copy(error = "Selecciona una categoría") }
            return
        }
        _uiState.update { it.copy(isSaving = true, error = null) }
        viewModelScope.launch {
            val form = ExpenseForm(
                tripId = tripId,
                amount = amount,
                currency = state.currency,
                category = state.category,
                description = state.description.ifBlank { null },
                date = state.date,
                billable = state.billable,
                loyaltyCardId = null,
                userCurrencyBase = state.userCurrencyBase,
            )
            createExpenseUseCase(form)
                .onSuccess { expense ->
                    _uiState.update { it.copy(isSaving = false, savedExpenseId = expense.id) }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(isSaving = false, error = e.localizedMessage ?: "Error al guardar")
                    }
                }
        }
    }
}
