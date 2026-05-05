package com.ledger.app.presentation.screen.trips.list

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.data.repository.TripRepository
import com.ledger.app.domain.model.Trip
import com.ledger.app.domain.model.TripStatus
import com.ledger.app.domain.usecase.trip.GetTripsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

sealed class TripsUiState {
    object Loading : TripsUiState()
    data class Success(
        val activeTrips: List<Trip>,
        val otherTrips: List<Trip>,
        val pendingOpsCount: Int,
    ) : TripsUiState()
    data class Error(val message: String) : TripsUiState()
}

@HiltViewModel
class TripsViewModel @Inject constructor(
    private val getTripsUseCase: GetTripsUseCase,
    private val tripRepository: TripRepository,
) : ViewModel() {

    val uiState: StateFlow<TripsUiState> = combine(
        getTripsUseCase(),
        tripRepository.observePendingOpsCount(),
    ) { trips, pendingCount ->
        val today = LocalDate.now()
        val active = trips.filter { trip ->
            trip.status == TripStatus.active &&
            !trip.startDate.isAfter(today) &&
            !trip.endDate.isBefore(today)
        }
        val others = trips.filterNot { it in active }
        TripsUiState.Success(active, others, pendingCount)
    }
        .catch { e -> emit(TripsUiState.Error(e.localizedMessage ?: "Error al cargar viajes")) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = TripsUiState.Loading,
        )

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            tripRepository.syncFromServer()
            _isRefreshing.value = false
        }
    }
}
