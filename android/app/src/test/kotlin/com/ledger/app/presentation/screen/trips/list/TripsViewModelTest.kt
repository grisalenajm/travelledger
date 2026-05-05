package com.ledger.app.presentation.screen.trips.list

import app.cash.turbine.test
import com.ledger.app.domain.model.Trip
import com.ledger.app.domain.model.TripStatus
import com.ledger.app.domain.usecase.trip.GetTripsUseCase
import com.ledger.app.fake.FakeTripRepository
import com.ledger.app.util.MainCoroutineRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate
import kotlin.test.assertIs

@OptIn(ExperimentalCoroutinesApi::class)
class TripsViewModelTest {

    @get:Rule
    val coroutineRule = MainCoroutineRule()

    private lateinit var fakeTripRepository: FakeTripRepository
    private lateinit var viewModel: TripsViewModel

    @Before
    fun setUp() {
        fakeTripRepository = FakeTripRepository()
        viewModel = TripsViewModel(
            getTripsUseCase = GetTripsUseCase(fakeTripRepository),
            tripRepository = fakeTripRepository,
        )
    }

    @Test
    fun `sin viajes activos uiState muestra CTA vacio`() = runTest {
        fakeTripRepository.setTrips(emptyList())

        viewModel.uiState.test {
            val state = awaitItem()
            assertIs<TripsUiState.Success>(state)
            assertEquals(0, (state as TripsUiState.Success).activeTrips.size)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `con viaje activo uiState muestra hero card`() = runTest {
        val activeTrip = Trip(
            id = "trip-1",
            name = "Tokyo",
            description = null,
            destination = "Japan",
            startDate = LocalDate.now().minusDays(1),
            endDate = LocalDate.now().plusDays(5),
            primaryCurrency = "JPY",
            budget = 5000.0,
            budgetCurrency = "CHF",
            status = TripStatus.active,
        )
        fakeTripRepository.setTrips(listOf(activeTrip))

        viewModel.uiState.test {
            val state = awaitItem()
            assertIs<TripsUiState.Success>(state)
            assertEquals(1, (state as TripsUiState.Success).activeTrips.size)
            assertEquals("Tokyo", state.activeTrips[0].name)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `pull-to-refresh llama syncFromServer`() = runTest {
        fakeTripRepository.setTrips(emptyList())

        viewModel.uiState.test {
            awaitItem() // consume initial state

            viewModel.refresh()

            assertTrue(fakeTripRepository.syncFromServerCalled)
            cancelAndIgnoreRemainingEvents()
        }
    }
}
