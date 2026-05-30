package com.ledger.app.presentation.screen.trips.create

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.domain.model.Trip
import com.ledger.app.domain.model.TripStatus
import com.ledger.app.domain.usecase.trip.CreateTripUseCase
import com.ledger.app.util.UuidGenerator
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class CreateTripFormState(
    val name: String = "",
    val destination: String = "",
    val startDateMillis: Long? = null,
    val endDateMillis: Long? = null,
    val primaryCurrency: String = "EUR",
    val budget: String = "",
    val budgetCurrency: String = "EUR",
    val status: TripStatus = TripStatus.active,
)

@HiltViewModel
class CreateTripViewModel @Inject constructor(
    private val createTripUseCase: CreateTripUseCase,
) : ViewModel() {

    private val _form = MutableStateFlow(CreateTripFormState())
    val form: StateFlow<CreateTripFormState> = _form.asStateFlow()

    val isFormValid: StateFlow<Boolean> = _form.map { f ->
        f.name.isNotBlank() &&
        f.destination.isNotBlank() &&
        f.primaryCurrency.isNotBlank() &&
        f.startDateMillis != null &&
        f.endDateMillis != null
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = false,
    )

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun updateName(value: String) = _form.update { it.copy(name = value) }
    fun updateDestination(value: String) = _form.update { it.copy(destination = value) }
    fun updateDates(startMillis: Long?, endMillis: Long?) =
        _form.update { it.copy(startDateMillis = startMillis, endDateMillis = endMillis) }
    fun updatePrimaryCurrency(value: String) = _form.update { it.copy(primaryCurrency = value) }
    fun updateBudget(value: String) = _form.update { it.copy(budget = value) }
    fun updateBudgetCurrency(value: String) = _form.update { it.copy(budgetCurrency = value) }
    fun updateStatus(value: TripStatus) = _form.update { it.copy(status = value) }

    fun createTrip(onSuccess: () -> Unit) {
        val f = _form.value
        if (!isFormValid.value) return
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            val id = UuidGenerator.generate()
            val startDate = LocalDate.ofEpochDay(f.startDateMillis!! / 86_400_000L)
            val endDate = LocalDate.ofEpochDay(f.endDateMillis!! / 86_400_000L)
            val trip = Trip(
                id = id,
                name = f.name.trim(),
                description = null,
                destination = f.destination.trim(),
                startDate = startDate,
                endDate = endDate,
                primaryCurrency = f.primaryCurrency,
                budget = f.budget.toDoubleOrNull() ?: 0.0,
                budgetCurrency = f.budgetCurrency,
                status = f.status,
            )
            val result = createTripUseCase(trip)
            _isLoading.value = false
            if (result.isSuccess) {
                onSuccess()
            } else {
                _error.value = result.exceptionOrNull()?.localizedMessage ?: "Error al crear el viaje"
            }
        }
    }

    fun clearError() { _error.value = null }
}
