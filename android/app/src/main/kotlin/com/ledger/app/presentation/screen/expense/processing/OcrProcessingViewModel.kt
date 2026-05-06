package com.ledger.app.presentation.screen.expense.processing

import android.content.Context
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.domain.usecase.expense.ProcessReceiptUseCase
import com.ledger.app.util.UuidGenerator
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import java.io.IOException
import java.net.ConnectException
import java.net.UnknownHostException
import javax.inject.Inject

enum class OcrStep { Saving, Uploading, Analyzing, Done, Failed }

data class OcrProcessingUiState(
    val step: OcrStep = OcrStep.Saving,
    val error: String? = null,
    val isOffline: Boolean = false,
)

sealed class OcrEvent {
    data class NavigateToExpenseDetail(val expenseId: String) : OcrEvent()
    data class NavigateToQuickCaptureManual(val tripId: String) : OcrEvent()
}

@HiltViewModel
class OcrProcessingViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @ApplicationContext private val context: Context,
    private val processReceiptUseCase: ProcessReceiptUseCase,
) : ViewModel() {

    private val tripId: String = checkNotNull(savedStateHandle["tripId"])
    val imagePath: String = checkNotNull(savedStateHandle["imagePath"])

    private val _uiState = MutableStateFlow(OcrProcessingUiState())
    val uiState: StateFlow<OcrProcessingUiState> = _uiState.asStateFlow()

    private val _events = Channel<OcrEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    init {
        startProcessing()
    }

    fun startProcessing() {
        viewModelScope.launch {
            _uiState.value = OcrProcessingUiState(step = OcrStep.Saving)

            val pendingDir = File(context.filesDir, "pending_uploads").also { it.mkdirs() }
            val operationId = UuidGenerator.generate()
            val destFile = File(pendingDir, "$operationId.jpg")
            runCatching { File(imagePath).copyTo(destFile, overwrite = true) }

            _uiState.update { it.copy(step = OcrStep.Uploading) }
            delay(300)
            _uiState.update { it.copy(step = OcrStep.Analyzing) }

            processReceiptUseCase(destFile, tripId)
                .onSuccess { ocrResult ->
                    _uiState.update { it.copy(step = OcrStep.Done) }
                    _events.send(OcrEvent.NavigateToExpenseDetail(ocrResult.expenseId))
                }
                .onFailure { e ->
                    val isOffline = e is UnknownHostException ||
                            e is ConnectException ||
                            e is IOException
                    _uiState.update {
                        it.copy(
                            step = OcrStep.Failed,
                            isOffline = isOffline,
                            error = if (!isOffline) e.message else null,
                        )
                    }
                }
        }
    }

    fun onContinueManually() {
        viewModelScope.launch {
            _events.send(OcrEvent.NavigateToQuickCaptureManual(tripId))
        }
    }
}
