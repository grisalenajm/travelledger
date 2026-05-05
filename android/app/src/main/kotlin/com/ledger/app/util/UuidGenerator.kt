package com.ledger.app.util

import java.util.UUID

object UuidGenerator {
    fun generate(): String = UUID.randomUUID().toString()
}
