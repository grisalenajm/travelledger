package com.ledger.app.domain.usecase.trip

import com.ledger.app.data.repository.TripRepository
import com.ledger.app.domain.model.Trip
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class GetActiveTripUseCase @Inject constructor(
    private val tripRepository: TripRepository,
) {
    operator fun invoke(): Flow<Trip?> =
        tripRepository.getActiveTrips().map { trips ->
            trips.maxByOrNull { it.startDate }
        }
}
