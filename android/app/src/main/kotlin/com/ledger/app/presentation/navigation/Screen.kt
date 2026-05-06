package com.ledger.app.presentation.navigation

import android.net.Uri

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Config : Screen("config")
    object Login : Screen("login")
    object Register : Screen("register")
    object Trips : Screen("trips")
    object CreateTrip : Screen("trips/create")
    object Settings : Screen("settings")
    object ExpenseDetail : Screen("expense/detail/{expenseId}?isOcrDraft={isOcrDraft}") {
        fun createRoute(expenseId: String, isOcrDraft: Boolean = false) =
            "expense/detail/$expenseId?isOcrDraft=$isOcrDraft"
    }
    object TripDetail : Screen("trips/{tripId}") {
        fun createRoute(tripId: String) = "trips/$tripId"
    }
    object QuickCapture : Screen("trips/{tripId}/capture/{day}?ocrResult={ocrResult}") {
        fun createRoute(tripId: String, day: String, ocrResultJson: String? = null): String {
            val base = "trips/$tripId/capture/$day"
            return if (ocrResultJson != null) {
                "$base?ocrResult=${Uri.encode(ocrResultJson)}"
            } else {
                base
            }
        }
    }
    object Camera : Screen("camera/{tripId}") {
        fun createRoute(tripId: String) = "camera/$tripId"
    }
    object OcrProcessing : Screen("ocr/{tripId}?imagePath={imagePath}") {
        fun createRoute(tripId: String, imagePath: String): String =
            "ocr/$tripId?imagePath=${Uri.encode(imagePath)}"
    }
    object Summary : Screen("trips/{tripId}/summary") {
        fun createRoute(tripId: String) = "trips/$tripId/summary"
    }
}
