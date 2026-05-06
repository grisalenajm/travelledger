package com.ledger.app.presentation.screen.expense.detail

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.presentation.component.AppTopBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseDetailScreen(
    onNavigateUp: () -> Unit,
    viewModel: ExpenseDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is ExpenseDetailEvent.NavigateBack -> onNavigateUp()
                is ExpenseDetailEvent.ShowSnackbar ->
                    snackbarHostState.showSnackbar(event.message)
            }
        }
    }

    Scaffold(
        topBar = {
            if (uiState.isEditing) {
                AppTopBar(
                    title = "Editar gasto",
                    showBack = true,
                    onBack = { viewModel.toggleEdit() },
                    actions = {
                        TextButton(
                            onClick = { viewModel.onSave() },
                            enabled = !uiState.isSaving,
                        ) {
                            Text("Guardar")
                        }
                    },
                )
            } else {
                AppTopBar(
                    title = "Gasto",
                    showBack = true,
                    onBack = onNavigateUp,
                    actions = {
                        IconButton(onClick = { viewModel.toggleEdit() }) {
                            Icon(Icons.Default.Edit, contentDescription = "Editar")
                        }
                        IconButton(onClick = { viewModel.requestDelete() }) {
                            Icon(Icons.Default.Delete, contentDescription = "Eliminar")
                        }
                    },
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { paddingValues ->
        when {
            uiState.isLoading -> {
                Box(
                    Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
            uiState.error != null && uiState.expense == null -> {
                Box(
                    Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(uiState.error!!)
                }
            }
            uiState.isEditing -> {
                EditForm(
                    uiState = uiState,
                    viewModel = viewModel,
                    modifier = Modifier.padding(paddingValues),
                )
            }
            else -> {
                ViewMode(
                    uiState = uiState,
                    onOpenReceipt = { url ->
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        context.startActivity(intent)
                    },
                    modifier = Modifier.padding(paddingValues),
                )
            }
        }
    }

    if (uiState.showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { viewModel.cancelDelete() },
            title = { Text("Eliminar gasto") },
            text = { Text("¿Eliminar este gasto? Esta acción no se puede deshacer.") },
            confirmButton = {
                TextButton(onClick = { viewModel.confirmDelete() }) {
                    Text("Eliminar", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.cancelDelete() }) { Text("Cancelar") }
            },
        )
    }
}

@Composable
private fun ViewMode(
    uiState: ExpenseDetailUiState,
    onOpenReceipt: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val expense = uiState.expense ?: return
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (uiState.isOcrDraft) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                ),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Revisa los campos detectados automáticamente",
                    modifier = Modifier.padding(12.dp),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        Text(
            text = "${expense.currency} %.2f".format(expense.amount),
            style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.ExtraBold),
        )
        if (expense.currency != uiState.userCurrencyBase) {
            Text(
                text = "→ ${uiState.userCurrencyBase} %.2f".format(expense.amountBase),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        DetailRow("Categoría", "${expense.category.emoji()} ${expense.category.name}")
        DetailRow("Fecha", expense.date.toString())
        expense.description?.let { DetailRow("Descripción", it) }
        DetailRow("Facturable", if (expense.billable) "Sí 💼" else "No")

        if (uiState.receiptUrl.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            OutlinedButton(
                onClick = { onOpenReceipt(uiState.receiptUrl) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("🧾 Ver factura")
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(value, style = MaterialTheme.typography.bodyLarge)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditForm(
    uiState: ExpenseDetailUiState,
    viewModel: ExpenseDetailViewModel,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (uiState.isOcrDraft) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                ),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Revisa los campos detectados automáticamente",
                    modifier = Modifier.padding(12.dp),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        OutlinedTextField(
            value = uiState.editAmount,
            onValueChange = { viewModel.onEditAmount(it) },
            label = { Text("Importe") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
            isError = uiState.error != null,
            singleLine = true,
            textStyle = MaterialTheme.typography.headlineMedium.copy(
                fontWeight = FontWeight.ExtraBold,
                fontSize = 36.sp,
            ),
        )

        OutlinedTextField(
            value = uiState.editCurrency,
            onValueChange = { viewModel.onEditCurrency(it.uppercase().take(3)) },
            label = { Text("Moneda") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )

        Text("Categoría", style = MaterialTheme.typography.labelMedium)
        Row(modifier = Modifier.horizontalScroll(rememberScrollState())) {
            ExpenseCategory.entries.forEach { cat ->
                FilterChip(
                    selected = uiState.editCategory == cat,
                    onClick = { viewModel.onEditCategory(cat) },
                    label = { Text("${cat.emoji()} ${cat.name}") },
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
        }

        OutlinedTextField(
            value = uiState.editDescription,
            onValueChange = { viewModel.onEditDescription(it) },
            label = { Text("Descripción") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("💼 Facturable", style = MaterialTheme.typography.bodyLarge)
            Switch(
                checked = uiState.editBillable,
                onCheckedChange = { viewModel.onEditBillable(it) },
            )
        }

        uiState.error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Button(
            onClick = { viewModel.onSave() },
            enabled = !uiState.isSaving,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (uiState.isSaving) "Guardando..." else "Guardar")
        }
    }
}
