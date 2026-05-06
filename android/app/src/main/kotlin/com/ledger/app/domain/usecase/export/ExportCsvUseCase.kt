package com.ledger.app.domain.usecase.export

import com.ledger.app.data.repository.ExportRepository
import com.ledger.app.util.FileShareUtil
import javax.inject.Inject

class ExportCsvUseCase @Inject constructor(
    private val exportRepository: ExportRepository,
    private val fileShareUtil: FileShareUtil,
) {
    suspend operator fun invoke(tripId: String, tripName: String): Result<Unit> {
        val result = exportRepository.downloadCsv(tripId)
        return result.mapCatching { bytes ->
            fileShareUtil.shareCsv(bytes, tripName)
        }
    }
}
