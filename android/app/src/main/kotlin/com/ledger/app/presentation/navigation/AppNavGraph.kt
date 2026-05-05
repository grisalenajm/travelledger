package com.ledger.app.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.ledger.app.presentation.screen.auth.login.LoginScreen
import com.ledger.app.presentation.screen.auth.register.RegisterScreen
import com.ledger.app.presentation.screen.config.ConfigScreen
import com.ledger.app.presentation.screen.splash.SplashScreen
import com.ledger.app.presentation.screen.trips.create.CreateTripScreen
import com.ledger.app.presentation.screen.trips.list.TripsScreen

@Composable
fun AppNavGraph(
    navController: NavHostController,
    startDestination: String = Screen.Splash.route,
) {
    NavHost(navController = navController, startDestination = startDestination) {
        composable(Screen.Splash.route) {
            SplashScreen(
                onNavigateToConfig = {
                    navController.navigate(Screen.Config.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToTrips = {
                    navController.navigate(Screen.Trips.route) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                },
            )
        }
        composable(Screen.Config.route) {
            ConfigScreen(
                onConfigured = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Config.route) { inclusive = true }
                    }
                },
            )
        }
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Trips.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToRegister = { navController.navigate(Screen.Register.route) },
            )
        }
        composable(Screen.Register.route) {
            RegisterScreen(
                onRegisterSuccess = { navController.popBackStack() },
                onNavigateToLogin = { navController.popBackStack() },
            )
        }
        composable(Screen.Trips.route) {
            TripsScreen(
                onNavigateToCreateTrip = { navController.navigate(Screen.CreateTrip.route) },
                onNavigateToTripDetail = { /* TripDetailDestination — implemented in A6 */ },
            )
        }
        composable(Screen.CreateTrip.route) {
            CreateTripScreen(
                onCreated = {
                    navController.navigate(Screen.Trips.route) {
                        popUpTo(Screen.Trips.route) { inclusive = true }
                    }
                },
                onNavigateUp = { navController.navigateUp() },
            )
        }
    }
}
