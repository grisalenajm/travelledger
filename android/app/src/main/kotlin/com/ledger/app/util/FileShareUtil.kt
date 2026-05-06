package com.ledger.app.util

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FileShareUtil @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    fun shareCsv(bytes: ByteArray, tripName: String) {
        val slug = tripName
            .lowercase()
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
        val date = LocalDate.now().toString()
        val fileName = "gastos_${slug}_${date}.csv"

        val exportsDir = File(context.cacheDir, "exports").also { it.mkdirs() }
        val file = File(exportsDir, fileName)
        file.writeBytes(bytes)

        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file,
        )

        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/csv"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "Gastos — $tripName")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(Intent.createChooser(shareIntent, "Exportar CSV").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }
}
