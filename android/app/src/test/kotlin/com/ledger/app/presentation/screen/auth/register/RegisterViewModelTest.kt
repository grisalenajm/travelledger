package com.ledger.app.presentation.screen.auth.register

import app.cash.turbine.test
import com.ledger.app.domain.usecase.auth.RegisterUseCase
import com.ledger.app.fake.FakeAuthRepository
import com.ledger.app.util.MainCoroutineRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import kotlin.test.assertIs

@OptIn(ExperimentalCoroutinesApi::class)
class RegisterViewModelTest {

    @get:Rule
    val coroutineRule = MainCoroutineRule()

    private val fakeAuthRepository = FakeAuthRepository()
    private lateinit var viewModel: RegisterViewModel

    @Before
    fun setUp() {
        viewModel = RegisterViewModel(RegisterUseCase(fakeAuthRepository))
    }

    @Test
    fun `passwords distintos devuelven error sin llamar al repositorio`() = runTest {
        viewModel.uiState.test {
            assertIs<RegisterUiState.Idle>(awaitItem())
            viewModel.register("Test", "test@example.com", "Pass1!", "Pass2!", "EUR")
            val errorState = awaitItem()
            assertIs<RegisterUiState.Error>(errorState)
            assertTrue((errorState as RegisterUiState.Error).message.contains("contraseñas"))
        }
        assertNull(fakeAuthRepository.registerCalledWith)
    }

    @Test
    fun `registro exitoso navega a login`() = runTest {
        fakeAuthRepository.registerResult = Result.success(Unit)
        var navigated = false
        viewModel.uiState.test {
            assertIs<RegisterUiState.Idle>(awaitItem())
            viewModel.register(
                name = "Test User",
                email = "test@example.com",
                password = "Password1!",
                confirmPassword = "Password1!",
                currencyBase = "EUR",
                onSuccess = { navigated = true },
            )
            assertIs<RegisterUiState.Loading>(awaitItem())
            assertIs<RegisterUiState.Idle>(awaitItem())
        }
        assertTrue(navigated)
    }

    @Test
    fun `registro fallido muestra error`() = runTest {
        fakeAuthRepository.registerResult = Result.failure(Exception("Email already registered"))
        viewModel.uiState.test {
            assertIs<RegisterUiState.Idle>(awaitItem())
            viewModel.register(
                name = "Test User",
                email = "existing@example.com",
                password = "Password1!",
                confirmPassword = "Password1!",
                currencyBase = "EUR",
            )
            assertIs<RegisterUiState.Loading>(awaitItem())
            val errorState = awaitItem()
            assertIs<RegisterUiState.Error>(errorState)
        }
    }
}
