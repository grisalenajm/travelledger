package com.ledger.app.presentation.screen.expense.processing

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OcrProcessingScreen(
    onNavigateUp: () -> Unit,
    onNavigateToExpenseDetail: (expenseId: String) -> Unit,
    onNavigateToQuickCaptureManual: (tripId: String) -> Unit,
    viewModel: OcrProcessingViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is OcrEvent.NavigateToExpenseDetail ->
                    onNavigateToExpenseDetail(event.expenseId)
                is OcrEvent.NavigateToQuickCaptureManual ->
                    onNavigateToQuickCaptureManual(event.tripId)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Procesando...") },
                navigationIcon = {
                    IconButton(onClick = onNavigateUp) {
                        Icon(Icons.Default.Close, contentDescription = "Cancelar")
                    }
                },
            )
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Spacer(Modifier.height(8.dp))

            // Ticket thumbnail with scanning overlay
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(12.dp)),
            ) {
                AsyncImage(
                    model = File(viewModel.imagePath),
                    contentDescription = "Ticket",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
                if (uiState.step == OcrStep.Uploading || uiState.step == OcrStep.Analyzing) {
                    ThumbnailScanLine()
                }
            }

            // Progress steps
            OcrStepRow(
                label = "Imagen guardada localmente",
                isDone = uiState.step >= OcrStep.Uploading,
                isActive = uiState.step == OcrStep.Saving,
                isVisible = true,
            )
            OcrStepRow(
                label = "Subiendo al servidor...",
                isDone = uiState.step >= OcrStep.Analyzing,
                isActive = uiState.step == OcrStep.Uploading,
                isVisible = uiState.step >= OcrStep.Uploading,
            )
            OcrStepRow(
                label = "Analizando con IA...",
                isDone = uiState.step == OcrStep.Done,
                isActive = uiState.step == OcrStep.Analyzing,
                isVisible = uiState.step >= OcrStep.Analyzing,
            )

            if (uiState.step == OcrStep.Failed) {
                OcrFailedContent(
                    isOffline = uiState.isOffline,
                    errorMessage = uiState.error,
                    onContinueManually = { viewModel.onContinueManually() },
                    onRetry = { viewModel.startProcessing() },
                )
            } else if (uiState.step != OcrStep.Done) {
                Spacer(Modifier.weight(1f))
                OutlinedButton(
                    onClick = onNavigateUp,
                    modifier = Modifier.padding(bottom = 16.dp),
                ) {
                    Text("Cancelar")
                }
            }
        }
    }
}

@Composable
private fun OcrStepRow(
    label: String,
    isDone: Boolean,
    isActive: Boolean,
    isVisible: Boolean,
) {
    if (!isVisible) return
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            isDone -> Icon(
                imageVector = Icons.Default.Check,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp),
            )
            isActive -> CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            else -> Spacer(Modifier.size(20.dp))
        }
        Text(label, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun ThumbnailScanLine() {
    val infiniteTransition = rememberInfiniteTransition(label = "scan")
    val scanY by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "scanY",
    )
    Canvas(modifier = Modifier.fillMaxSize()) {
        val y = size.height * scanY
        drawLine(
            brush = Brush.horizontalGradient(
                colors = listOf(Color.Transparent, Color(0xFF004d64), Color.Transparent),
            ),
            start = Offset(0f, y),
            end = Offset(size.width, y),
            strokeWidth = 2.dp.toPx(),
        )
    }
}

@Composable
private fun OcrFailedContent(
    isOffline: Boolean,
    errorMessage: String?,
    onContinueManually: () -> Unit,
    onRetry: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            if (isOffline) "❌ Sin conexión" else "❌ Error al procesar",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.error,
        )
        Text(
            if (isOffline)
                "Tu foto se ha guardado. Se procesará cuando vuelvas a tener conexión."
            else
                errorMessage ?: "Error desconocido",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = onContinueManually) {
                Text("Continuar manualmente")
            }
            Button(onClick = onRetry) {
                Text("Reintentar")
            }
        }
    }
}
