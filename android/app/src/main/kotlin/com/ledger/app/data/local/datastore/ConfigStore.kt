package com.ledger.app.data.local.datastore

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

open class ConfigStore(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "ledger_config",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_INVITE_CODE = "invite_code"
        private const val KEY_LAST_EMAIL = "last_email"
    }

    open suspend fun getServerUrl(): String? = withContext(Dispatchers.IO) {
        prefs.getString(KEY_SERVER_URL, null)
    }

    open suspend fun getInviteCode(): String? = withContext(Dispatchers.IO) {
        prefs.getString(KEY_INVITE_CODE, null)
    }

    open suspend fun getLastEmail(): String? = withContext(Dispatchers.IO) {
        prefs.getString(KEY_LAST_EMAIL, null)
    }

    open suspend fun saveServerConfig(serverUrl: String, inviteCode: String) = withContext(Dispatchers.IO) {
        prefs.edit()
            .putString(KEY_SERVER_URL, serverUrl)
            .putString(KEY_INVITE_CODE, inviteCode)
            .apply()
    }

    open suspend fun saveLastEmail(email: String) = withContext(Dispatchers.IO) {
        prefs.edit()
            .putString(KEY_LAST_EMAIL, email)
            .apply()
    }

    open suspend fun clear() = withContext(Dispatchers.IO) {
        prefs.edit()
            .remove(KEY_SERVER_URL)
            .remove(KEY_INVITE_CODE)
            .remove(KEY_LAST_EMAIL)
            .apply()
    }
}
