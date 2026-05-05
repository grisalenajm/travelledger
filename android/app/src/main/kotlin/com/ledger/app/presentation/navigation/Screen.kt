package com.ledger.app.presentation.navigation

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Config : Screen("config")
    object Login : Screen("login")
    object Register : Screen("register")
    object Trips : Screen("trips")
    object CreateTrip : Screen("trips/create")
}
