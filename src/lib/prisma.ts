import { PrismaClient } from '@/generated/prisma'
import { PrismaNeon } from '@prisma/adapter-neon'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida — configúrala en tus variables de entorno (Neon Postgres).')
  }
  // PrismaNeon uses Neon's HTTP driver instead of a persistent TCP connection.
  // In serverless (Netlify functions) this eliminates the TCP handshake on every
  // cold start, cutting DB latency from ~500ms to ~50ms per invocation.
  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter, log: ['error'] } as ConstructorParameters<typeof PrismaClient>[0])
}

// Lazy singleton: the client is NOT created at module import time.
// This prevents Next.js from throwing during the build phase (static analysis)
// when DATABASE_URL is not yet injected. The client is created on first use.
let _client: PrismaClient | undefined

function getClient(): PrismaClient {
  if (!_client) {
    _client = globalForPrisma.prisma ?? createPrismaClient()
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _client
  }
  return _client
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
