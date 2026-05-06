package com.ledger.app.data.repository

import com.ledger.app.data.local.room.dao.ExpenseDao
import com.ledger.app.data.local.room.dao.PendingOperationDao
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

    override suspend fun getById(id: String): Expense? = withContext(Dispatchers.IO) {
        expenseDao.getById(id)?.toDomain()
    }

    override suspend fun fetchById(id: String): Expense? = withContext(Dispatchers.IO) {
        try {
            val dto = expenseApi.getExpense(id)
            val entity = dto.toEntity()
            expenseDao.upsert(entity)
            entity.toDomain()
        } catch (e: Exception) {
            null
        }
    }

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

    override suspend fun update(expense: Expense): Result<Expense> = runCatching {
        withContext(Dispatchers.IO) {
            expenseDao.upsert(expense.toEntity(syncPending = true))
            val op = PendingOperationEntity(
                operationId = UUID.randomUUID().toString(),
                type = "update_expense",
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
            val op = PendingOperationEntity(
                operationId = UUID.randomUUID().toString(),
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
                expenseDao.upsert(dto.toEntity())
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
