package com.ledger.app.domain.usecase.trip

import com.ledger.app.data.repository.TripRepository
import com.ledger.app.domain.model.Trip
import javax.inject.Inject

class CreateTripUseCase @Inject constructor(
    private val tripRepository: TripRepository,
) {
    suspend operator fun invoke(trip: Trip): Result<Trip> = tripRepository.create(trip)
}
