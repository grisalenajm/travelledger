package com.ledger.app.presentation.screen.expense.processing

import android.content.Context
import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import com.ledger.app.domain.model.ExpenseCategory
import com.ledger.app.domain.model.OcrResult
import com.ledger.app.domain.usecase.expense.ProcessReceiptUseCase
import com.ledger.app.util.MainCoroutineRule
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.net.UnknownHostException
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class OcrProcessingViewModelTest {

    @get:Rule
    val coroutineRule = MainCoroutineRule()

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var mockContext: Context
    private lateinit var mockUseCase: ProcessReceiptUseCase
    private lateinit var imageFile: File

    private val testTripId = "trip-xyz"

    @Before
    fun setUp() {
        imageFile = tempFolder.newFile("test.jpg").also { it.writeText("fake image") }
        mockContext = mockk(relaxed = true)
        mockUseCase = mockk()
        every { mockContext.filesDir } returns tempFolder.root
    }

    private fun buildViewModel(
        ocrResult: Result<OcrResult> = Result.success(fakeOcrResult()),
    ): OcrProcessingViewModel {
        coEvery { mockUseCase(any(), any()) } returns ocrResult
        return OcrProcessingViewModel(
            savedStateHandle = SavedStateHandle(
                mapOf("tripId" to testTripId, "imagePath" to imageFile.absolutePath),
            ),
            context = mockContext,
            processReceiptUseCase = mockUseCase,
        )
    }

    @Test
    fun `OCR exitoso - state llega a Done`() = runTest {
        val viewModel = buildViewModel()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.uiState.test {
            assertEquals(OcrStep.Done, awaitItem().step)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `OCR exitoso - emite NavigateToQuickCapture con tripId y json no vacio`() = runTest {
        val viewModel = buildViewModel()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.events.test {
            val event = awaitItem() as OcrEvent.NavigateToQuickCapture
            assertEquals(testTripId, event.tripId)
            assertTrue(event.ocrResultJson.isNotBlank())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `sin red - step es Failed con isOffline true`() = runTest {
        val viewModel = buildViewModel(Result.failure(UnknownHostException("no network")))
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(OcrStep.Failed, state.step)
            assertTrue(state.isOffline)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `error servidor - step es Failed con isOffline false`() = runTest {
        val viewModel = buildViewModel(Result.failure(RuntimeException("500 Server Error")))
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(OcrStep.Failed, state.step)
            assertFalse(state.isOffline)
            assertTrue(state.error?.contains("500") == true)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `reintentar relanza el usecase`() = runTest {
        var callCount = 0
        coEvery { mockUseCase(any(), any()) } answers {
            callCount++
            if (callCount == 1) Result.failure(RuntimeException("first fail"))
            else Result.success(fakeOcrResult())
        }
        val viewModel = OcrProcessingViewModel(
            savedStateHandle = SavedStateHandle(
                mapOf("tripId" to testTripId, "imagePath" to imageFile.absolutePath),
            ),
            context = mockContext,
            processReceiptUseCase = mockUseCase,
        )
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()
        viewModel.startProcessing()
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(2, callCount)
    }

    @Test
    fun `onContinueManually - emite NavigateToQuickCaptureManual con tripId`() = runTest {
        val viewModel = buildViewModel(Result.failure(UnknownHostException()))
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.events.test {
            viewModel.onContinueManually()
            val event = awaitItem() as OcrEvent.NavigateToQuickCaptureManual
            assertEquals(testTripId, event.tripId)
            cancelAndIgnoreRemainingEvents()
        }
    }

    private fun fakeOcrResult() = OcrResult(
        expenseId = "expense-draft-1",
        paperlessDocId = 7,
        date = LocalDate.of(2024, 10, 14),
        amount = 78.30,
        currency = "EUR",
        category = ExpenseCategory.Dining,
        description = "Le Bistrot",
    )
}
