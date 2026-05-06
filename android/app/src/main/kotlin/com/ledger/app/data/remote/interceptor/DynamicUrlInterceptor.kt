package com.ledger.app.data.remote.interceptor

import com.ledger.app.data.local.datastore.ConfigStore
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response

class DynamicUrlInterceptor(private val configStore: ConfigStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val baseUrl = runBlocking { configStore.getServerUrl() }
            ?: return chain.proceed(chain.request())

        val newBase = baseUrl.trimEnd('/').toHttpUrl()
        val newUrl = chain.request().url.newBuilder()
            .scheme(newBase.scheme)
            .host(newBase.host)
            .port(newBase.port)
            .build()

        return chain.proceed(chain.request().newBuilder().url(newUrl).build())
    }
}
