package com.ledger.app.presentation.component

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ledger.app.domain.model.Expense

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ExpenseCard(
    expense: Expense,
    userCurrencyBase: String,
    onClick: (() -> Unit)? = null,
    onLongClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    ElevatedCard(
        modifier = modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = { onClick?.invoke() },
                onLongClick = { onLongClick?.invoke() },
            ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f),
            ) {
                Text(
                    text = expense.category.emoji(),
                    style = MaterialTheme.typography.titleLarge,
                )
                Column {
                    Text(
                        text = expense.description ?: expense.category.name,
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                    )
                    if (expense.currency != userCurrencyBase) {
                        Text(
                            text = "→ $userCurrencyBase %.2f".format(expense.amountBase),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${expense.currency} %.2f".format(expense.amount),
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (expense.billable) {
                    Text(text = "💼", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
