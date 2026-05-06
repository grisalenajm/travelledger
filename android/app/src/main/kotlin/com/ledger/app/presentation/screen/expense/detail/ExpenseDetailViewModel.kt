package com.ledger.app.presentation.screen.expense.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.data.local.datastore.ConfigStore
import com.ledger.app.data.repository.ExpenseRepository
import com.ledger.app.data.repository.TripRepository
import com.ledger.app.domain.model.Expense
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.domain.usecase.expense.DeleteExpenseUseCase
import com.ledger.app.domain.usecase.expense.UpdateExpenseUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class ExpenseDetailUiState(
    val expense: Expense? = null,
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val isEditing: Boolean = false,
    val isOcrDraft: Boolean = false,
    val error: String? = null,
    val deleted: Boolean = false,
    val showDeleteDialog: Boolean = false,
    val userCurrencyBase: String = "EUR",
    val receiptUrl: String = "",
    val editAmount: String = "",
    val editCurrency: String = "",
    val editCategory: ExpenseCategory? = null,
    val editDescription: String = "",
    val editDate: LocalDate = LocalDate.now(),
    val editBillable: Boolean = true,
)

sealed class ExpenseDetailEvent {
    object NavigateBack : ExpenseDetailEvent()
    data class ShowSnackbar(val message: String) : ExpenseDetailEvent()
}

@HiltViewModel
class ExpenseDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val expenseRepository: ExpenseRepository,
    private val tripRepository: TripRepository,
    private val updateExpenseUseCase: UpdateExpenseUseCase,
    private val deleteExpenseUseCase: DeleteExpenseUseCase,
    private val configStore: ConfigStore,
) : ViewModel() {

    private val expenseId: String = checkNotNull(savedStateHandle["expenseId"])
    private val isOcrDraftArg: Boolean = savedStateHandle["isOcrDraft"] ?: false

    private val _uiState = MutableStateFlow(ExpenseDetailUiState(isOcrDraft = isOcrDraftArg))
    val uiState: StateFlow<ExpenseDetailUiState> = _uiState.asStateFlow()

    private val _events = Channel<ExpenseDetailEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    init {
        loadExpense()
    }

    private fun loadExpense() {
        viewModelScope.launch {
            val local = expenseRepository.getById(expenseId)
            val expense = local ?: expenseRepository.fetchById(expenseId)
            if (expense != null) {
                val serverUrl = configStore.getServerUrl()?.trimEnd('/') ?: ""
                val receiptUrl = if (expense.paperlessDocId != null) {
                    "$serverUrl/api/expenses/${expense.id}/receipt-image"
                } else {
                    ""
                }
                _uiState.update {
                    it.copy(
                        expense = expense,
                        isLoading = false,
                        receiptUrl = receiptUrl,
                    )
                }
                loadCurrencyBase(expense.tripId)
            } else {
                _uiState.update { it.copy(isLoading = false, error = "Gasto no encontrado") }
            }
        }
    }

    private fun loadCurrencyBase(tripId: String) {
        viewModelScope.launch {
            val trips = tripRepository.getTrips().first()
            val trip = trips.find { it.id == tripId }
            if (trip != null) {
                _uiState.update { it.copy(userCurrencyBase = trip.budgetCurrency) }
            }
        }
    }

    fun toggleEdit() {
        val state = _uiState.value
        if (state.isEditing) {
            _uiState.update { it.copy(isEditing = false) }
        } else {
            val expense = state.expense ?: return
            _uiState.update {
                it.copy(
                    isEditing = true,
                    editAmount = expense.amount.toString(),
                    editCurrency = expense.currency,
                    editCategory = expense.category,
                    editDescription = expense.description ?: "",
                    editDate = expense.date,
                    editBillable = expense.billable,
                )
            }
        }
    }

    fun onEditAmount(value: String) = _uiState.update { it.copy(editAmount = value) }
    fun onEditCurrency(value: String) = _uiState.update { it.copy(editCurrency = value) }
    fun onEditCategory(value: ExpenseCategory) = _uiState.update { it.copy(editCategory = value) }
    fun onEditDescription(value: String) = _uiState.update { it.copy(editDescription = value) }
    fun onEditDate(value: LocalDate) = _uiState.update { it.copy(editDate = value) }
    fun onEditBillable(value: Boolean) = _uiState.update { it.copy(editBillable = value) }

    fun onSave() {
        val state = _uiState.value
        val expense = state.expense ?: return
        val amount = state.editAmount.toDoubleOrNull()
        if (amount == null || amount <= 0) {
            _uiState.update { it.copy(error = "Introduce un importe válido") }
            return
        }
        val category = state.editCategory
        if (category == null) {
            _uiState.update { it.copy(error = "Selecciona una categoría") }
            return
        }
        _uiState.update { it.copy(isSaving = true, error = null) }
        viewModelScope.launch {
            val updated = expense.copy(
                amount = amount,
                currency = state.editCurrency,
                category = category,
                description = state.editDescription.ifBlank { null },
                date = state.editDate,
                billable = state.editBillable,
            )
            updateExpenseUseCase(updated, state.userCurrencyBase)
                .onSuccess { saved ->
                    _uiState.update {
                        it.copy(
                            expense = saved,
                            isEditing = false,
                            isSaving = false,
                            isOcrDraft = false,
                        )
                    }
                    _events.send(ExpenseDetailEvent.ShowSnackbar("Gasto guardado"))
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(isSaving = false, error = e.localizedMessage ?: "Error al guardar")
                    }
                }
        }
    }

    fun requestDelete() = _uiState.update { it.copy(showDeleteDialog = true) }

    fun cancelDelete() = _uiState.update { it.copy(showDeleteDialog = false) }

    fun confirmDelete() {
        _uiState.update { it.copy(showDeleteDialog = false) }
        viewModelScope.launch {
            deleteExpenseUseCase(expenseId)
                .onSuccess {
                    _uiState.update { it.copy(deleted = true) }
                    _events.send(ExpenseDetailEvent.NavigateBack)
                }
                .onFailure { e ->
                    _events.send(
                        ExpenseDetailEvent.ShowSnackbar(e.localizedMessage ?: "Error al eliminar")
                    )
                }
        }
    }
}
