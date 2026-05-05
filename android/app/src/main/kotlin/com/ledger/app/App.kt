package com.ledger.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            // Timber.plant(Timber.DebugTree()) // add when Timber is added
        }
    }
}
