package com.ledger.app.presentation.screen.trips.list

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ledger.app.domain.model.Trip
import com.ledger.app.presentation.component.BudgetProgressBar
import com.ledger.app.presentation.component.TripCard
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TripsScreen(
    onNavigateToCreateTrip: () -> Unit,
    onNavigateToTripDetail: (String) -> Unit,
    viewModel: TripsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val pullToRefreshState = rememberPullToRefreshState()

    if (pullToRefreshState.isRefreshing) {
        LaunchedEffect(true) { viewModel.refresh() }
    }
    LaunchedEffect(isRefreshing) {
        if (!isRefreshing && pullToRefreshState.isRefreshing) {
            pullToRefreshState.endRefresh()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Ledger", style = MaterialTheme.typography.headlineSmall)
                },
                actions = {
                    val pendingCount = (uiState as? TripsUiState.Success)?.pendingOpsCount ?: 0
                    if (pendingCount > 0) {
                        BadgedBox(badge = {
                            Badge { Text(pendingCount.toString()) }
                        }) {
                            Icon(Icons.Default.Cloud, contentDescription = "Sincronización pendiente")
                        }
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNavigateToCreateTrip) {
                Icon(Icons.Default.Add, contentDescription = "Crear viaje")
            }
        },
    ) { paddingValues ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .nestedScroll(pullToRefreshState.nestedScrollConnection),
        ) {
            when (val state = uiState) {
                is TripsUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is TripsUiState.Error -> {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(state.message, style = MaterialTheme.typography.bodyMedium)
                        TextButton(onClick = { viewModel.refresh() }) { Text("Reintentar") }
                    }
                }
                is TripsUiState.Success -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        if (state.activeTrips.isEmpty()) {
                            item {
                                EmptyTripsCard(onCreateTrip = onNavigateToCreateTrip)
                            }
                        } else if (state.activeTrips.size == 1) {
                            item {
                                HeroTripCard(
                                    trip = state.activeTrips[0],
                                    onContinue = { onNavigateToTripDetail(state.activeTrips[0].id) },
                                )
                            }
                        } else {
                            item {
                                Text(
                                    "Viajes en curso",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    items(state.activeTrips) { trip ->
                                        HeroTripCard(
                                            trip = trip,
                                            onContinue = { onNavigateToTripDetail(trip.id) },
                                            modifier = Modifier.fillParentMaxWidth(0.85f),
                                        )
                                    }
                                }
                            }
                        }

                        if (state.otherTrips.isNotEmpty()) {
                            item {
                                Text(
                                    "Otros viajes",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(top = 8.dp),
                                )
                            }
                            items(state.otherTrips, key = { it.id }) { trip ->
                                TripCard(
                                    trip = trip,
                                    onClick = { onNavigateToTripDetail(trip.id) },
                                )
                            }
                        }
                    }
                }
            }

            PullToRefreshContainer(
                state = pullToRefreshState,
                modifier = Modifier.align(Alignment.TopCenter),
            )
        }
    }
}

@Composable
private fun HeroTripCard(
    trip: Trip,
    onContinue: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val today = LocalDate.now()
    val dayNumber = ChronoUnit.DAYS.between(trip.startDate, today).toInt() + 1
    val dayLabel = today.format(DateTimeFormatter.ofPattern("d MMM", Locale.getDefault()))

    Card(
        modifier = modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(trip.name, style = MaterialTheme.typography.headlineMedium)
            Text(
                "Día $dayNumber · $dayLabel",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            if (trip.budget > 0) {
                BudgetProgressBar(
                    spent = 0.0,
                    budget = trip.budget,
                    currency = trip.budgetCurrency,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Button(onClick = onContinue, modifier = Modifier.fillMaxWidth()) {
                Text("Continuar →")
            }
        }
    }
}

@Composable
private fun EmptyTripsCard(onCreateTrip: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Sin viajes activos",
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                "Crea tu primer viaje para empezar a registrar gastos.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(onClick = onCreateTrip) { Text("Crear viaje") }
        }
    }
}
