package com.ledger.app.fake

import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.domain.model.OcrResult
import com.ledger.app.domain.usecase.expense.ProcessReceiptUseCase
import io.mockk.mockk
import java.io.File
import java.time.LocalDate

class FakeProcessReceiptUseCase(
    private val result: Result<OcrResult> = Result.success(defaultOcrResult()),
) {
    var lastImageFile: File? = null
    var lastTripId: String? = null
    var callCount = 0

    suspend operator fun invoke(imageFile: File, tripId: String): Result<OcrResult> {
        lastImageFile = imageFile
        lastTripId = tripId
        callCount++
        return result
    }

    companion object {
        fun defaultOcrResult() = OcrResult(
            expenseId = "expense-ocr-123",
            paperlessDocId = 42,
            date = LocalDate.of(2024, 10, 14),
            amount = 12450.0,
            currency = "JPY",
            category = ExpenseCategory.Dining,
            description = "Le Bistrot Paris",
        )
    }
}
