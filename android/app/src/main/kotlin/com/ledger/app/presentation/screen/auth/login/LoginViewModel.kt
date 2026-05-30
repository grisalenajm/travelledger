package com.ledger.app.presentation.screen.auth.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.data.local.datastore.ConfigStore
import com.ledger.app.domain.usecase.auth.LoginUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class LoginUiState {
    object Idle : LoginUiState()
    object Loading : LoginUiState()
    data class Error(val message: String) : LoginUiState()
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val loginUseCase: LoginUseCase,
    private val configStore: ConfigStore,
) : ViewModel() {

    private val _uiState = MutableStateFlow<LoginUiState>(LoginUiState.Idle)
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private val _lastEmail = MutableStateFlow("")
    val lastEmail: StateFlow<String> = _lastEmail.asStateFlow()

    init {
        viewModelScope.launch {
            _lastEmail.value = configStore.getLastEmail() ?: ""
        }
    }

    fun login(email: String, password: String, onSuccess: () -> Unit = {}) {
        if (email.isBlank() || password.isBlank()) return
        viewModelScope.launch {
            _uiState.value = LoginUiState.Loading
            val result = loginUseCase(email, password)
            _uiState.value = if (result.isSuccess) {
                onSuccess()
                LoginUiState.Idle
            } else {
                LoginUiState.Error(
                    result.exceptionOrNull()?.localizedMessage ?: "Error al iniciar sesión"
                )
            }
        }
    }

    fun clearError() {
        _uiState.value = LoginUiState.Idle
    }
}
