package com.ledger.app.presentation.screen.auth.login

import app.cash.turbine.test
import com.ledger.app.data.local.datastore.ConfigStore
import com.ledger.app.domain.usecase.auth.LoginUseCase
import com.ledger.app.fake.FakeAuthRepository
import com.ledger.app.util.MainCoroutineRule
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import kotlin.test.assertIs

@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {

    @get:Rule
    val coroutineRule = MainCoroutineRule()

    private val fakeAuthRepository = FakeAuthRepository()
    private val mockConfigStore = mockk<ConfigStore>(relaxed = true)
    private lateinit var viewModel: LoginViewModel

    @Before
    fun setUp() {
        coEvery { mockConfigStore.getLastEmail() } returns "test@example.com"
        viewModel = LoginViewModel(LoginUseCase(fakeAuthRepository), mockConfigStore)
    }

    @Test
    fun `login exitoso navega a trips`() = runTest {
        fakeAuthRepository.loginResult = Result.success(Unit)
        var navigated = false
        viewModel.uiState.test {
            assertIs<LoginUiState.Idle>(awaitItem())
            viewModel.login("test@example.com", "Password1!", { navigated = true })
            assertIs<LoginUiState.Loading>(awaitItem())
            assertIs<LoginUiState.Idle>(awaitItem())
        }
        assertTrue(navigated)
    }

    @Test
    fun `login con credenciales incorrectas devuelve error`() = runTest {
        fakeAuthRepository.loginResult = Result.failure(Exception("Invalid credentials"))
        viewModel.uiState.test {
            assertIs<LoginUiState.Idle>(awaitItem())
            viewModel.login("test@example.com", "WrongPass1!")
            assertIs<LoginUiState.Loading>(awaitItem())
            val errorState = awaitItem()
            assertIs<LoginUiState.Error>(errorState)
        }
    }

    @Test
    fun `login con campos vacios no llama al repositorio`() = runTest {
        viewModel.login("", "")
        assertNull(fakeAuthRepository.loginCalledWith)
    }
}
