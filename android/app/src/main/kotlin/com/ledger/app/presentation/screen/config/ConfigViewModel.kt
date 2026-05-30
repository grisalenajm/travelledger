package com.ledger.app.presentation.screen.config

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.data.local.datastore.ConfigStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Named

sealed class ConfigUiState {
    object Idle : ConfigUiState()
    object Loading : ConfigUiState()
    data class Error(val message: String) : ConfigUiState()
}

@HiltViewModel
class ConfigViewModel @Inject constructor(
    private val configStore: ConfigStore,
    // AuthApi NOT injected here — validation calls go directly to the user-provided URL.
    // Must use @Named("raw") to bypass DynamicUrlInterceptor (which reads ConfigStore).
    @Named("raw") private val okHttpClient: OkHttpClient,
) : ViewModel() {

    private val _uiState = MutableStateFlow<ConfigUiState>(ConfigUiState.Idle)
    val uiState: StateFlow<ConfigUiState> = _uiState.asStateFlow()

    fun validate(serverUrl: String, inviteCode: String, onSuccess: () -> Unit) {
        if (!isValidUrl(serverUrl)) {
            _uiState.value = ConfigUiState.Error("URL inválida. Debe empezar con http:// o https://")
            return
        }
        val base = serverUrl.trimEnd('/')
        viewModelScope.launch {
            _uiState.value = ConfigUiState.Loading
            try {
                // 1. Connectivity check
                val healthRequest = Request.Builder().url("$base/health").get().build()
                val healthResponse = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(healthRequest).execute()
                }
                val healthOk = healthResponse.isSuccessful || healthResponse.code == 404
                healthResponse.close()
                if (!healthOk) {
                    _uiState.value = ConfigUiState.Error("No se puede conectar al servidor. Verifica la URL.")
                    return@launch
                }

                // 2. Validate invite code — direct POST to the user-supplied URL
                val jsonBody = """{"code":"$inviteCode"}""".toRequestBody("application/json".toMediaType())
                val validateRequest = Request.Builder()
                    .url("$base/api/auth/validate-invite")
                    .post(jsonBody)
                    .build()
                val validateResponse = withContext(Dispatchers.IO) {
                    okHttpClient.newCall(validateRequest).execute()
                }
                val validateOk = validateResponse.isSuccessful
                validateResponse.close()
                if (!validateOk) {
                    _uiState.value = ConfigUiState.Error("Código de invitación inválido")
                    return@launch
                }

                configStore.saveServerConfig(base, inviteCode)
                _uiState.value = ConfigUiState.Idle
                onSuccess()
            } catch (e: Exception) {
                _uiState.value = ConfigUiState.Error("Error de conexión: ${e.localizedMessage}")
            }
        }
    }

    fun clearError() {
        _uiState.value = ConfigUiState.Idle
    }

    private fun isValidUrl(url: String): Boolean =
        url.startsWith("http://") || url.startsWith("https://")
}
