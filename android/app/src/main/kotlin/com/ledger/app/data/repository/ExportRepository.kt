package com.ledger.app.data.repository

interface ExportRepository {
    suspend fun downloadCsv(tripId: String): Result<ByteArray>
}
