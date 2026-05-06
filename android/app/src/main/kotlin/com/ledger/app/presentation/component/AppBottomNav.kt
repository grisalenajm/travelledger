package com.ledger.app.presentation.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.ledger.app.presentation.navigation.Screen

@Composable
fun AppBottomNav(
    navController: NavController,
    onScanClick: () -> Unit = {},
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    NavigationBar {
        NavigationBarItem(
            icon = { Icon(Icons.Default.Home, contentDescription = "Inicio") },
            label = { Text("Inicio") },
            selected = currentRoute == Screen.Trips.route,
            onClick = {
                navController.navigate(Screen.Trips.route) {
                    popUpTo(Screen.Trips.route) { inclusive = true }
                    launchSingleTop = true
                }
            },
        )
        NavigationBarItem(
            icon = {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(MaterialTheme.colorScheme.primary, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Default.CameraAlt,
                        contentDescription = "Escanear",
                        tint = MaterialTheme.colorScheme.onPrimary,
                    )
                }
            },
            label = { Text("Escanear") },
            selected = false,
            onClick = onScanClick,
        )
        NavigationBarItem(
            icon = { Icon(Icons.Default.Settings, contentDescription = "Ajustes") },
            label = { Text("Ajustes") },
            selected = currentRoute == Screen.Settings.route,
            onClick = {
                navController.navigate(Screen.Settings.route) {
                    launchSingleTop = true
                }
            },
        )
    }
}
