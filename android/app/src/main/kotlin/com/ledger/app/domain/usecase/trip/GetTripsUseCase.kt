package com.ledger.app.domain.usecase.trip

import com.ledger.app.data.repository.TripRepository
import com.ledger.app.domain.model.Trip
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetTripsUseCase @Inject constructor(
    private val tripRepository: TripRepository,
) {
    operator fun invoke(): Flow<List<Trip>> = tripRepository.getTrips()
}
