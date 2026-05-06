package com.ledger.app.presentation.navigation

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.ledger.app.presentation.screen.auth.login.LoginScreen
import com.ledger.app.presentation.screen.auth.register.RegisterScreen
import com.ledger.app.presentation.screen.config.ConfigScreen
import com.ledger.app.presentation.screen.expense.camera.CameraScreen
import com.ledger.app.presentation.screen.expense.capture.QuickCaptureScreen
import com.ledger.app.presentation.screen.expense.detail.ExpenseDetailScreen
import com.ledger.app.presentation.screen.expense.processing.OcrProcessingScreen
import com.ledger.app.presentation.screen.splash.SplashScreen
import com.ledger.app.presentation.screen.trips.create.CreateTripScreen
import com.ledger.app.presentation.screen.trips.detail.TripDetailScreen
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
                onNavigateToTripDetail = { tripId ->
                    navController.navigate(Screen.TripDetail.createRoute(tripId))
                },
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
        composable(
            route = Screen.TripDetail.route,
            arguments = listOf(navArgument("tripId") { type = NavType.StringType }),
            enterTransition = { slideInHorizontally { it } },
            exitTransition = { slideOutHorizontally { it } },
        ) {
            TripDetailScreen(
                onNavigateUp = { navController.navigateUp() },
                onNavigateToQuickCapture = { tripId, day ->
                    navController.navigate(Screen.QuickCapture.createRoute(tripId, day))
                },
                onNavigateToCamera = { tripId ->
                    navController.navigate(Screen.Camera.createRoute(tripId))
                },
                onNavigateToSummary = { /* SummaryDestination — A7 */ },
                onNavigateToExpenseDetail = { expenseId ->
                    navController.navigate(Screen.ExpenseDetail.createRoute(expenseId))
                },
            )
        }
        composable(
            route = Screen.QuickCapture.route,
            arguments = listOf(
                navArgument("tripId") { type = NavType.StringType },
                navArgument("day") { type = NavType.StringType },
                navArgument("ocrResult") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                },
            ),
            enterTransition = { slideInVertically { it } },
            exitTransition = { slideOutVertically { it } },
        ) {
            QuickCaptureScreen(
                onNavigateUp = { navController.popBackStack() },
                onNavigateToCamera = { tripId ->
                    navController.navigate(Screen.Camera.createRoute(tripId))
                },
            )
        }
        composable(
            route = Screen.Camera.route,
            arguments = listOf(navArgument("tripId") { type = NavType.StringType }),
            enterTransition = { fadeIn() },
            exitTransition = { fadeOut() },
        ) { backStackEntry ->
            val tripId = backStackEntry.arguments?.getString("tripId") ?: return@composable
            CameraScreen(
                onNavigateUp = { navController.navigateUp() },
                onNavigateToOcrProcessing = { imagePath ->
                    navController.navigate(Screen.OcrProcessing.createRoute(tripId, imagePath))
                },
                onNavigateToQuickCaptureManual = {
                    val day = java.time.LocalDate.now().toString()
                    navController.navigate(Screen.QuickCapture.createRoute(tripId, day)) {
                        popUpTo(Screen.Camera.createRoute(tripId)) { inclusive = true }
                    }
                },
            )
        }
        composable(
            route = Screen.OcrProcessing.route,
            arguments = listOf(
                navArgument("tripId") { type = NavType.StringType },
                navArgument("imagePath") { type = NavType.StringType },
            ),
            enterTransition = { fadeIn() },
            exitTransition = { fadeOut() },
        ) {
            OcrProcessingScreen(
                onNavigateUp = { navController.navigateUp() },
                onNavigateToExpenseDetail = { expenseId ->
                    navController.navigate(
                        Screen.ExpenseDetail.createRoute(expenseId, isOcrDraft = true)
                    ) {
                        popUpTo(Screen.TripDetail.route)
                    }
                },
                onNavigateToQuickCaptureManual = { tripId ->
                    val day = java.time.LocalDate.now().toString()
                    navController.navigate(Screen.QuickCapture.createRoute(tripId, day)) {
                        popUpTo(Screen.TripDetail.route)
                    }
                },
            )
        }
        composable(
            route = Screen.ExpenseDetail.route,
            arguments = listOf(
                navArgument("expenseId") { type = NavType.StringType },
                navArgument("isOcrDraft") { type = NavType.BoolType; defaultValue = false },
            ),
            enterTransition = { slideInHorizontally { it } },
            exitTransition = { slideOutHorizontally { it } },
        ) {
            ExpenseDetailScreen(
                onNavigateUp = { navController.navigateUp() },
                viewModel = hiltViewModel(),
            )
        }
    }
}
