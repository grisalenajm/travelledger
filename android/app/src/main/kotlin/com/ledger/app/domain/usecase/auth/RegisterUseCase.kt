package com.ledger.app.domain.usecase.auth

import com.ledger.app.data.repository.AuthRepository
import javax.inject.Inject

class RegisterUseCase @Inject constructor(
    private val authRepository: AuthRepository,
) {
    suspend operator fun invoke(
        name: String,
        email: String,
        password: String,
        currencyBase: String,
    ): Result<Unit> = authRepository.register(name, email, password, currencyBase)
}
