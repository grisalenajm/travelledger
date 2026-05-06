package com.ledger.app.presentation.screen.summary

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.presentation.component.AppTopBar

private val donutColors = listOf(
    Color(0xFF004D64),
    Color(0xFF006684),
    Color(0xFF526166),
    Color(0xFF885116),
    Color(0xFFBFC8CD),
    Color(0xFF3F484D),
)

@Composable
fun SummaryScreen(
    onNavigateUp: () -> Unit,
    viewModel: SummaryViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Resumen",
                showBack = true,
                onBack = onNavigateUp,
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            item {
                TripHeaderSection(uiState)
            }
            item {
                BudgetProgressSection(uiState)
            }
            if (uiState.byCategory.isNotEmpty()) {
                item {
                    DonutChartSection(uiState)
                }
                item {
                    CategoryBreakdownSection(uiState)
                }
            }
            if (uiState.byCurrency.isNotEmpty()) {
                item {
                    CurrencyBreakdownSection(uiState)
                }
            }
            item {
                BillableSection(uiState)
            }
            item {
                ExportSection(
                    isOnline = uiState.isOnline,
                    isExporting = uiState.isExporting,
                    exportError = uiState.exportError,
                    onExportCsv = { viewModel.exportCsv() },
                )
            }
        }
    }
}

@Composable
private fun TripHeaderSection(state: SummaryUiState) {
    val trip = state.trip ?: return
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Text(
            text = trip.name,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = "${trip.startDate} — ${trip.endDate}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun BudgetProgressSection(state: SummaryUiState) {
    val trip = state.trip ?: return
    if (trip.budget <= 0) return
    val progress = (state.totalBase / trip.budget).toFloat().coerceIn(0f, 1f)
    val overBudget = state.totalBase > trip.budget

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(
            text = "Total gastado",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = "${state.baseCurrency} ${String.format("%.2f", state.totalBase)}",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = "de ${state.baseCurrency} ${String.format("%.2f", trip.budget)} presupuestado (${(progress * 100).toInt()}%)",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(6.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxWidth(),
            color = if (overBudget) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
        )
    }
}

@Composable
private fun DonutChartSection(state: SummaryUiState) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Por categoría",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
        )
        Box(contentAlignment = Alignment.Center) {
            DonutChart(
                categories = state.byCategory,
                modifier = Modifier.size(200.dp),
            )
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = String.format("%.2f", state.totalBase),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = state.baseCurrency,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
fun DonutChart(
    categories: List<CategoryTotal>,
    modifier: Modifier = Modifier,
) {
    Canvas(modifier = modifier) {
        val strokeWidth = 40.dp.toPx()
        val radius = (size.minDimension - strokeWidth) / 2
        val center = Offset(size.width / 2, size.height / 2)
        var startAngle = -90f

        categories.forEachIndexed { i, cat ->
            val sweep = cat.percentage * 360f
            drawArc(
                color = donutColors[i % donutColors.size],
                startAngle = startAngle,
                sweepAngle = sweep,
                useCenter = false,
                style = Stroke(width = strokeWidth, cap = StrokeCap.Butt),
                topLeft = Offset(center.x - radius, center.y - radius),
                size = Size(radius * 2, radius * 2),
            )
            startAngle += sweep
        }
    }
}

@Composable
private fun CategoryBreakdownSection(state: SummaryUiState) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        state.byCategory.forEachIndexed { i, cat ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Box(
                        modifier = Modifier.size(12.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Canvas(modifier = Modifier.size(12.dp)) {
                            drawCircle(color = donutColors[i % donutColors.size])
                        }
                    }
                    Text(
                        text = "${cat.category.emoji()} ${cat.category.name}",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${state.baseCurrency} ${String.format("%.2f", cat.amountBase)}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                    )
                    Text(
                        text = "${(cat.percentage * 100).toInt()}%",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun CurrencyBreakdownSection(state: SummaryUiState) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = "Por moneda",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        state.byCurrency.forEach { cur ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "${cur.currency} ${String.format("%.2f", cur.amount)}",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    text = "${state.baseCurrency} ${String.format("%.2f", cur.amountBase)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun BillableSection(state: SummaryUiState) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ElevatedCard(modifier = Modifier.weight(1f)) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text("💼", fontSize = 24.sp)
                Text(
                    text = "Facturable",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "${state.baseCurrency} ${String.format("%.2f", state.totalBillable)}",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        ElevatedCard(modifier = Modifier.weight(1f)) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text("🧍", fontSize = 24.sp)
                Text(
                    text = "Personal",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "${state.baseCurrency} ${String.format("%.2f", state.totalPersonal)}",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun ExportSection(
    isOnline: Boolean,
    isExporting: Boolean,
    exportError: String?,
    onExportCsv: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "Exportar",
            style = MaterialTheme.typography.titleMedium,
        )
        Button(
            onClick = onExportCsv,
            enabled = isOnline && !isExporting,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (isExporting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
                Spacer(Modifier.width(8.dp))
            }
            Text(if (isExporting) "Exportando..." else "Descargar CSV")
        }
        OutlinedButton(
            onClick = {},
            enabled = false,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Descargar ZIP (CSV + facturas)")
        }
        if (!isOnline) {
            Text(
                text = "Conecta a internet para exportar",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
        } else {
            Text(
                text = "ZIP disponible próximamente",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (exportError != null) {
            Text(
                text = exportError,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}
