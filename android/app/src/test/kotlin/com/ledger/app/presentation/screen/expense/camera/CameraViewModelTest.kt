package com.ledger.app.presentation.screen.expense.camera

import app.cash.turbine.test
import com.ledger.app.data.camera.CameraManager
import com.ledger.app.util.MainCoroutineRule
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertInstanceOf
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
class CameraViewModelTest {

    @get:Rule
    val coroutineRule = MainCoroutineRule()

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var fakeCameraManager: CameraManager
    private lateinit var viewModel: CameraViewModel

    @Before
    fun setUp() {
        fakeCameraManager = mockk(relaxed = true)
        viewModel = CameraViewModel(fakeCameraManager)
    }

    @Test
    fun `estado inicial es Preview`() = runTest {
        viewModel.uiState.test {
            assertInstanceOf(CameraUiState.Preview::class.java, awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `onCapture exitoso - estado cambia a Captured con fichero`() = runTest {
        val capturedFile = tempFolder.newFile("photo.jpg")
        val onSuccessSlot = slot<(File) -> Unit>()
        every {
            fakeCameraManager.takePicture(any(), capture(onSuccessSlot), any())
        } answers {
            onSuccessSlot.captured(capturedFile)
        }

        viewModel.uiState.test {
            assertInstanceOf(CameraUiState.Preview::class.java, awaitItem())
            viewModel.onCapture(tempFolder.root)
            val captured = awaitItem() as CameraUiState.Captured
            assertEquals(capturedFile, captured.file)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `onRetake desde Captured - estado vuelve a Preview`() = runTest {
        val capturedFile = tempFolder.newFile("photo.jpg")
        val onSuccessSlot = slot<(File) -> Unit>()
        every {
            fakeCameraManager.takePicture(any(), capture(onSuccessSlot), any())
        } answers {
            onSuccessSlot.captured(capturedFile)
        }

        viewModel.onCapture(tempFolder.root)
        coroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        viewModel.uiState.test {
            val state = awaitItem()
            // May be Captured or Preview depending on timing — just call retake
            viewModel.onRetake()
            val afterRetake = awaitItem()
            assertInstanceOf(CameraUiState.Preview::class.java, afterRetake)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `onProcess - emite NavigateToOcrProcessing con ruta del fichero`() = runTest {
        val file = tempFolder.newFile("capture.jpg")

        viewModel.events.test {
            viewModel.onProcess(file)
            val event = awaitItem() as CameraEvent.NavigateToOcrProcessing
            assertEquals(file.absolutePath, event.imagePath)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `onProcess - estado cambia a Processing`() = runTest {
        val file = tempFolder.newFile("capture2.jpg")
        viewModel.uiState.test {
            awaitItem() // Preview
            viewModel.onProcess(file)
            val processing = awaitItem()
            assertInstanceOf(CameraUiState.Processing::class.java, processing)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `torch toggle - llama a cameraManager`() {
        every { fakeCameraManager.hasTorch() } returns true
        viewModel.onToggleTorch()
        verify { fakeCameraManager.toggleTorch(true) }
        viewModel.onToggleTorch()
        verify { fakeCameraManager.toggleTorch(false) }
    }
}
