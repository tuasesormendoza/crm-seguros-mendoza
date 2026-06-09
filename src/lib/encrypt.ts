// AES-256-GCM symmetric encryption for sensitive fields stored in the DB.
// Requires ENCRYPTION_KEY env var: a 64-char hex string (32 bytes).
//
// How to generate a key (run once in Terminal):
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Then add ENCRYPTION_KEY=<result> to Netlify environment variables.
//
// Graceful degradation: if ENCRYPTION_KEY is not set, data is stored/returned
// as plaintext (current behavior). Once the key is set, NEW writes are encrypted
// and existing plaintext is returned as-is (auto-migration on next save).
//
// Encrypted format stored in DB: "enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>"

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const MARKER = 'enc:'

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw || raw.length !== 64) return null
  try { return Buffer.from(raw, 'hex') } catch { return null }
}

export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext) return plaintext ?? null
  const key = getKey()
  if (!key) return plaintext // No key → store as plaintext
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return MARKER + [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':')
}

export function decrypt(value: string | null | undefined): string | null {
  if (!value) return value ?? null
  if (!value.startsWith(MARKER)) return value // Plaintext passthrough (legacy data)
  const key = getKey()
  if (!key) return null // Can't decrypt without key
  try {
    const parts = value.slice(MARKER.length).split(':')
    if (parts.length !== 3) return null
    const [ivHex, authTagHex, ciphertextHex] = parts
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
    return decipher.update(Buffer.from(ciphertextHex, 'hex')).toString('utf8') + decipher.final('utf8')
  } catch { return null }
}

// Decrypt sensitive fields in a client object before returning to the frontend.
// Also decrypts nested dependent SSNs if present.
export function decryptClientFields<T extends {
  ssn?: string | null
  portalPassword?: string | null
  bankAccount?: string | null
  bankRouting?: string | null
  dependents?: Array<Record<string, unknown> & { ssn?: string | null }>
}>(client: T): T {
  return {
    ...client,
    ssn: decrypt(client.ssn),
    portalPassword: decrypt(client.portalPassword),
    bankAccount: decrypt(client.bankAccount),
    bankRouting: decrypt(client.bankRouting),
    ...(client.dependents && {
      dependents: client.dependents.map(dep => ({ ...dep, ssn: decrypt(dep.ssn) })),
    }),
  }
}
