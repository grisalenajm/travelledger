package com.ledger.app.data.repository

import com.ledger.app.data.remote.api.ExportApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ExportRepositoryImpl @Inject constructor(
    private val exportApi: ExportApi,
) : ExportRepository {

    override suspend fun downloadCsv(tripId: String): Result<ByteArray> {
        return try {
            val responseBody = exportApi.downloadCsv(tripId)
            Result.success(responseBody.bytes())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
