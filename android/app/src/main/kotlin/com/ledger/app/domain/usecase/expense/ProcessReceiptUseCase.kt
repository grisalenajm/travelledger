package com.ledger.app.domain.usecase.expense

import com.ledger.app.data.remote.api.ReceiptApi
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.domain.model.OcrResult
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MultipartBody
import java.io.File
import javax.inject.Inject

class ProcessReceiptUseCase @Inject constructor(
    private val receiptApi: ReceiptApi,
) {
    suspend operator fun invoke(imageFile: File, tripId: String): Result<OcrResult> {
        return try {
            val requestBody = imageFile.asRequestBody("image/jpeg".toMediaType())
            val filePart = MultipartBody.Part.createFormData("file", imageFile.name, requestBody)
            val tripIdBody = tripId.toRequestBody("text/plain".toMediaType())
            val dto = receiptApi.uploadReceipt(filePart, tripIdBody)
            val ocrResult = OcrResult(
                expenseId = dto.id,
                paperlessDocId = dto.paperless_doc_id,
                date = runCatching { java.time.LocalDate.parse(dto.date) }.getOrNull(),
                amount = dto.amount.takeIf { it > 0 },
                currency = dto.currency.ifBlank { null },
                category = runCatching { ExpenseCategory.valueOf(dto.category) }.getOrNull(),
                description = dto.description,
            )
            Result.success(ocrResult)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
