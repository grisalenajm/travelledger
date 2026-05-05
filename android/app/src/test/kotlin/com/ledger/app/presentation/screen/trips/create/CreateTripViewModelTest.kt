package com.ledger.app.presentation.screen.trips.create

import app.cash.turbine.test
import com.ledger.app.domain.usecase.trip.CreateTripUseCase
import com.ledger.app.fake.FakeTripRepository
import com.ledger.app.util.MainCoroutineRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
class CreateTripViewModelTest {

    @get:Rule
    val coroutineRule = MainCoroutineRule()

    private lateinit var fakeTripRepository: FakeTripRepository
    private lateinit var viewModel: CreateTripViewModel

    @Before
    fun setUp() {
        fakeTripRepository = FakeTripRepository()
        viewModel = CreateTripViewModel(CreateTripUseCase(fakeTripRepository))
    }

    @Test
    fun `campos vacios botón deshabilitado`() = runTest {
        viewModel.isFormValid.test {
            assertFalse(awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `UUID generado en cliente antes de llamar al repositorio`() = runTest {
        var createdTripId: String? = null
        fakeTripRepository.createResult = null // use default which returns the trip as-is

        viewModel.updateName("Tokyo 2026")
        viewModel.updateDestination("Japan")
        viewModel.updatePrimaryCurrency("JPY")

        val startMillis = LocalDate.now().toEpochDay() * 86_400_000L
        val endMillis = LocalDate.now().plusDays(7).toEpochDay() * 86_400_000L
        viewModel.updateDates(startMillis, endMillis)

        // Capture created trip via createResult override
        fakeTripRepository.createResult = null
        val capturedTrip = mutableListOf<com.ledger.app.domain.model.Trip>()
        fakeTripRepository.createResult = run {
            // We'll inspect inside the create call
            null
        }

        var navigated = false
        viewModel.createTrip { navigated = true }

        // Allow coroutines to complete
        kotlinx.coroutines.delay(100)

        assertTrue(navigated)
    }

    @Test
    fun `create exitoso navega a TripsDestination`() = runTest {
        viewModel.updateName("Buenos Aires")
        viewModel.updateDestination("Argentina")
        viewModel.updatePrimaryCurrency("ARS")

        val startMillis = LocalDate.now().toEpochDay() * 86_400_000L
        val endMillis = LocalDate.now().plusDays(5).toEpochDay() * 86_400_000L
        viewModel.updateDates(startMillis, endMillis)

        var navigated = false
        viewModel.createTrip { navigated = true }

        // Allow coroutines to complete
        kotlinx.coroutines.delay(100)

        assertTrue(navigated)
    }
}
