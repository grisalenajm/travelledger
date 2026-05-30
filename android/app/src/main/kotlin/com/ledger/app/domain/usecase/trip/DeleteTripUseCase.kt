package com.ledger.app.domain.usecase.trip

import com.ledger.app.data.repository.TripRepository
import javax.inject.Inject

class DeleteTripUseCase @Inject constructor(
    private val tripRepository: TripRepository,
) {
    suspend operator fun invoke(id: String): Result<Unit> = tripRepository.delete(id)
}
