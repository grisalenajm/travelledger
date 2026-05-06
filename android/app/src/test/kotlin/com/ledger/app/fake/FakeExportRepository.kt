package com.ledger.app.fake

import com.ledger.app.data.repository.ExportRepository

class FakeExportRepository : ExportRepository {

    var downloadResult: Result<ByteArray> = Result.success("trip_id,amount\nfoo,1.00\n".toByteArray())
    var lastDownloadedTripId: String? = null

    override suspend fun downloadCsv(tripId: String): Result<ByteArray> {
        lastDownloadedTripId = tripId
        return downloadResult
    }
}
