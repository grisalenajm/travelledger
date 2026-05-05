package com.ledger.app.presentation.screen.trips.detail

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ledger.app.domain.model.Expense
import com.ledger.app.presentation.component.BudgetProgressBar
import com.ledger.app.presentation.component.DayChipStrip
import com.ledger.app.presentation.component.ExpenseCard
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun TripDetailScreen(
    onNavigateUp: () -> Unit,
    onNavigateToQuickCapture: (tripId: String, day: String) -> Unit,
    onNavigateToCamera: (tripId: String) -> Unit,
    onNavigateToSummary: (tripId: String) -> Unit,
    viewModel: TripDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    if (uiState.isLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    if (uiState.error != null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(uiState.error!!)
        }
        return
    }

    val trip = uiState.trip ?: return
    val days = uiState.days
    val selectedDay = uiState.selectedDay

    val initialPage = days.indexOf(selectedDay).coerceAtLeast(0)
    val pagerState = rememberPagerState(initialPage = initialPage) { days.size }

    // Sync pager → selectedDay
    LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.currentPage }.collect { page ->
            days.getOrNull(page)?.let { viewModel.selectDay(it) }
        }
    }

    // Sync selectedDay → pager (when chip tapped)
    LaunchedEffect(selectedDay) {
        val idx = days.indexOf(selectedDay)
        if (idx >= 0 && pagerState.currentPage != idx) {
            pagerState.animateScrollToPage(idx)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(trip.name, maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onNavigateUp) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver")
                    }
                },
                actions = {
                    if (uiState.pendingOpsCount > 0) {
                        BadgedBox(badge = { Badge { Text(uiState.pendingOpsCount.toString()) } }) {
                            Icon(Icons.Default.Cloud, contentDescription = "Sincronización pendiente")
                        }
                    }
                    IconButton(onClick = { onNavigateToSummary(trip.id) }) {
                        Icon(Icons.Default.BarChart, contentDescription = "Resumen")
                    }
                },
            )
        },
        bottomBar = {
            BottomAppBar {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = { onNavigateToCamera(trip.id) }) {
                        Icon(Icons.Default.PhotoCamera, contentDescription = "Escanear")
                    }
                    Button(
                        onClick = {
                            onNavigateToQuickCapture(trip.id, selectedDay.toString())
                        },
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Text(" Gasto")
                    }
                }
            }
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            if (trip.budget > 0) {
                BudgetProgressBar(
                    spent = 0.0,
                    budget = trip.budget,
                    currency = trip.budgetCurrency,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }

            if (days.isNotEmpty()) {
                DayChipStrip(
                    days = days,
                    selectedDay = selectedDay,
                    onDaySelected = { day ->
                        viewModel.selectDay(day)
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Spacer(Modifier.height(8.dp))

            if (days.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Este viaje no tiene días configurados.")
                }
            } else {
                HorizontalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxSize(),
                ) { page ->
                    val day = days.getOrNull(page)
                    if (day == null) {
                        Box(Modifier.fillMaxSize())
                        return@HorizontalPager
                    }
                    val isCurrentPage = day == selectedDay
                    DayPage(
                        expenses = if (isCurrentPage) uiState.expensesForDay else emptyList(),
                        totalForDay = if (isCurrentPage) uiState.totalForDay else 0.0,
                        currency = uiState.currencyBase,
                        day = day,
                        userCurrencyBase = uiState.currencyBase,
                        onAddExpense = {
                            onNavigateToQuickCapture(trip.id, day.toString())
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun DayPage(
    expenses: List<Expense>,
    totalForDay: Double,
    currency: String,
    day: LocalDate,
    userCurrencyBase: String,
    onAddExpense: () -> Unit,
) {
    if (expenses.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    "Sin gastos este día",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Pulsa + para añadir",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(expenses, key = { it.id }) { expense ->
                ExpenseCard(
                    expense = expense,
                    userCurrencyBase = userCurrencyBase,
                )
            }
            item {
                Text(
                    text = "Total día: $currency %.2f".format(totalForDay),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}
