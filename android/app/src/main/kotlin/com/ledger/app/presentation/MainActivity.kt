package com.ledger.app.presentation

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.LaunchedEffect
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.navigation.compose.rememberNavController
import com.ledger.app.R
import com.ledger.app.core.AuthEvent
import com.ledger.app.core.AuthEventBus
import com.ledger.app.presentation.navigation.AppNavGraph
import com.ledger.app.presentation.navigation.Screen
import com.ledger.app.presentation.theme.LedgerTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var authEventBus: AuthEventBus

    override fun onCreate(savedInstanceState: Bundle?) {
        @Suppress("UNUSED_VARIABLE")
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)

        setContent {
            LedgerTheme {
                val navController = rememberNavController()

                // Observe auth events (session expired)
                LaunchedEffect(Unit) {
                    authEventBus.events.collect { event ->
                        when (event) {
                            is AuthEvent.SessionExpired -> {
                                Toast.makeText(
                                    this@MainActivity,
                                    getString(R.string.session_expired),
                                    Toast.LENGTH_LONG,
                                ).show()
                                navController.navigate(Screen.Login.route) {
                                    popUpTo(0) { inclusive = true }
                                }
                            }
                        }
                    }
                }

                AppNavGraph(navController = navController)
            }
        }
    }
}
