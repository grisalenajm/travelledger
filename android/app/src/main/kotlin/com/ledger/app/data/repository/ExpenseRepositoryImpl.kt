package com.ledger.app.data.repository

import com.ledger.app.data.local.room.dao.ExpenseDao
import com.ledger.app.data.local.room.dao.PendingOperationDao
import com.ledger.app.data.local.room.entity.ExpenseEntity
import com.ledger.app.data.local.room.entity.PendingOperationEntity
import com.ledger.app.data.local.room.entity.toDomain
import com.ledger.app.data.local.room.entity.toEntity
import com.ledger.app.data.remote.api.ExpenseApi
import com.ledger.app.data.remote.api.dto.ExpenseCreateDto
import com.ledger.app.domain.model.Expense
import com.ledger.app.sync.SyncManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ExpenseRepositoryImpl @Inject constructor(
    private val expenseDao: ExpenseDao,
    private val pendingOperationDao: PendingOperationDao,
    private val expenseApi: ExpenseApi,
    private val syncManager: SyncManager,
    private val json: Json,
) : ExpenseRepository {

    override fun getExpensesByDay(tripId: String, date: LocalDate): Flow<List<Expense>> =
        expenseDao.getByTripAndDate(tripId, date.toString())
            .map { entities -> entities.map { it.toDomain() } }

    override fun getExpensesByTrip(tripId: String): Flow<List<Expense>> =
        expenseDao.getByTrip(tripId)
            .map { entities -> entities.map { it.toDomain() } }

    override suspend fun create(expense: Expense): Result<Expense> = runCatching {
        withContext(Dispatchers.IO) {
            expenseDao.upsert(expense.toEntity(syncPending = true))
            val op = PendingOperationEntity(
                operationId = expense.id,
                type = "create_expense",
                payload = json.encodeToString(expense.toCreateDto()),
                createdAt = System.currentTimeMillis(),
            )
            pendingOperationDao.upsert(op)
            syncManager.triggerOnDemand()
            expense
        }
    }

    override suspend fun delete(id: String): Result<Unit> = runCatching {
        withContext(Dispatchers.IO) {
            expenseDao.delete(id)
            val opId = UUID.randomUUID().toString()
            val op = PendingOperationEntity(
                operationId = opId,
                type = "delete_expense",
                payload = """{"id":"$id"}""",
                createdAt = System.currentTimeMillis(),
            )
            pendingOperationDao.upsert(op)
            syncManager.triggerOnDemand()
        }
    }

    override suspend fun syncFromServer(tripId: String): Result<Unit> = runCatching {
        withContext(Dispatchers.IO) {
            val expenses = expenseApi.getExpenses(tripId)
            expenses.forEach { dto ->
                expenseDao.upsert(
                    ExpenseEntity(
                        id = dto.id,
                        tripId = dto.trip_id,
                        amount = dto.amount,
                        currency = dto.currency,
                        amountBase = dto.amount_base,
                        rateDate = dto.rate_date,
                        category = dto.category,
                        description = dto.description,
                        date = dto.date,
                        billable = dto.billable,
                        loyaltyCardId = dto.loyalty_card_id,
                        paperlessDocId = dto.paperless_doc_id,
                        syncPending = false,
                    )
                )
            }
        }
    }
}

private fun Expense.toCreateDto(): ExpenseCreateDto = ExpenseCreateDto(
    id = id,
    trip_id = tripId,
    amount = amount,
    currency = currency,
    category = category.name,
    description = description,
    date = date.toString(),
    billable = billable,
    loyalty_card_id = loyaltyCardId,
)
