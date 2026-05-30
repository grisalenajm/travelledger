package com.ledger.app.presentation.screen.auth.register

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.domain.usecase.auth.RegisterUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class RegisterUiState {
    object Idle : RegisterUiState()
    object Loading : RegisterUiState()
    data class Error(val message: String) : RegisterUiState()
}

@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val registerUseCase: RegisterUseCase,
) : ViewModel() {

    private val _uiState = MutableStateFlow<RegisterUiState>(RegisterUiState.Idle)
    val uiState: StateFlow<RegisterUiState> = _uiState.asStateFlow()

    fun register(
        name: String,
        email: String,
        password: String,
        confirmPassword: String,
        currencyBase: String,
        onSuccess: () -> Unit = {},
    ) {
        if (password != confirmPassword) {
            _uiState.value = RegisterUiState.Error("Las contraseñas no coinciden")
            return
        }
        viewModelScope.launch {
            _uiState.value = RegisterUiState.Loading
            val result = registerUseCase(name, email, password, currencyBase)
            _uiState.value = if (result.isSuccess) {
                onSuccess()
                RegisterUiState.Idle
            } else {
                RegisterUiState.Error(
                    result.exceptionOrNull()?.localizedMessage ?: "Error al registrar"
                )
            }
        }
    }

    fun clearError() {
        _uiState.value = RegisterUiState.Idle
    }
}
