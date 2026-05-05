package com.ledger.app.presentation.screen.expense.camera

import android.content.Context
import android.net.Uri
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ledger.app.data.camera.CameraManager
import com.ledger.app.util.UuidGenerator
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

sealed class CameraUiState {
    object Preview : CameraUiState()
    data class Captured(val file: File) : CameraUiState()
    object Processing : CameraUiState()
    data class Error(val message: String) : CameraUiState()
}

sealed class CameraEvent {
    data class NavigateToOcrProcessing(val imagePath: String) : CameraEvent()
    object NavigateToQuickCaptureManual : CameraEvent()
}

@HiltViewModel
class CameraViewModel @Inject constructor(
    private val cameraManager: CameraManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow<CameraUiState>(CameraUiState.Preview)
    val uiState: StateFlow<CameraUiState> = _uiState.asStateFlow()

    private val _torchEnabled = MutableStateFlow(false)
    val torchEnabled: StateFlow<Boolean> = _torchEnabled.asStateFlow()

    private val _events = Channel<CameraEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    fun bindCamera(lifecycleOwner: LifecycleOwner, previewView: PreviewView) {
        cameraManager.startCamera(lifecycleOwner, previewView) {}
    }

    fun hasTorch(): Boolean = cameraManager.hasTorch()

    fun onToggleTorch() {
        val next = !_torchEnabled.value
        _torchEnabled.value = next
        cameraManager.toggleTorch(next)
    }

    fun onCapture(outputDir: File) {
        cameraManager.takePicture(
            outputDir = outputDir,
            onSuccess = { file ->
                _uiState.value = CameraUiState.Captured(file)
            },
            onError = { e ->
                _uiState.value = CameraUiState.Error(e.message ?: "Error al capturar foto")
            },
        )
    }

    fun onRetake() {
        _uiState.value = CameraUiState.Preview
    }

    fun onProcess(file: File) {
        _uiState.value = CameraUiState.Processing
        viewModelScope.launch {
            _events.send(CameraEvent.NavigateToOcrProcessing(file.absolutePath))
        }
    }

    fun onPickFromGallery(uri: Uri, context: Context) {
        viewModelScope.launch(Dispatchers.IO) {
            val cacheDir = File(context.cacheDir, "camera_picks").also { it.mkdirs() }
            val dest = File(cacheDir, "${UuidGenerator.generate()}.jpg")
            runCatching {
                context.contentResolver.openInputStream(uri)?.use { input ->
                    dest.outputStream().use { output -> input.copyTo(output) }
                }
            }.onSuccess {
                _events.send(CameraEvent.NavigateToOcrProcessing(dest.absolutePath))
            }.onFailure { e ->
                _uiState.value = CameraUiState.Error(e.message ?: "Error al leer imagen")
            }
        }
    }
}
