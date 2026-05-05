package com.ledger.app.presentation.screen.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.data.local.datastore.ConfigStore
import com.ledger.app.data.local.datastore.TokenStore
import com.ledger.app.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class SplashDestination {
    object Config : SplashDestination()
    object Login : SplashDestination()
    object Trips : SplashDestination()
}

@HiltViewModel
class SplashViewModel @Inject constructor(
    private val configStore: ConfigStore,
    private val tokenStore: TokenStore,
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _destination = MutableStateFlow<SplashDestination?>(null)
    val destination: StateFlow<SplashDestination?> = _destination.asStateFlow()

    init {
        resolve()
    }

    private fun resolve() {
        viewModelScope.launch {
            val serverUrl = configStore.getServerUrl()
            if (serverUrl.isNullOrBlank()) {
                _destination.value = SplashDestination.Config
                return@launch
            }
            val accessToken = tokenStore.getAccessToken()
            if (accessToken.isNullOrBlank()) {
                _destination.value = SplashDestination.Login
                return@launch
            }
            // Tokens exist — try refresh if expired
            val isExpired = tokenStore.isAccessTokenExpired()
            if (isExpired) {
                val result = authRepository.refreshToken()
                _destination.value = if (result.isSuccess) {
                    SplashDestination.Trips
                } else {
                    SplashDestination.Login
                }
            } else {
                _destination.value = SplashDestination.Trips
            }
        }
    }
}
