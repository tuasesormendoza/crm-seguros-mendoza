// Uploads every file currently in the local uploads/{clientId}/{storedName}
// folder structure into the Netlify Blobs "documents" store, preserving the
// same key layout (${clientId}/${storedName}) that src/lib/storage.ts expects.
//
// Run this from a machine/environment with Netlify Blobs credentials
// available (e.g. `netlify dev` locally with the site linked, or directly
// in a one-off Netlify function/build) — getStore() needs siteID + token
// when running outside of a deployed Netlify context.
//
// Usage (linked Netlify site):
//   netlify env:list   # sanity check
//   node scripts/migrate-uploads-to-blobs.mjs
//
// Usage (manual, with explicit credentials):
//   NETLIFY_SITE_ID=xxx NETLIFY_AUTH_TOKEN=xxx node scripts/migrate-uploads-to-blobs.mjs

import { getStore } from '@netlify/blobs'
import { readdir, readFile, stat } from 'fs/promises'
import path from 'path'

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads')

function store() {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (siteID && token) {
    return getStore({ name: 'documents', siteID, token, consistency: 'strong' })
  }
  // Falls back to ambient Netlify context (e.g. when run via `netlify dev`/functions)
  return getStore({ name: 'documents', consistency: 'strong' })
}

async function main() {
  const exists = await stat(UPLOADS_DIR).catch(() => null)
  if (!exists) {
    console.log('No uploads/ folder found — nothing to migrate.')
    return
  }

  const s = store()
  const clientDirs = await readdir(UPLOADS_DIR, { withFileTypes: true })
  let total = 0, ok = 0, failed = 0

  for (const dirent of clientDirs) {
    if (!dirent.isDirectory()) continue
    const clientId = dirent.name
    const clientDir = path.join(UPLOADS_DIR, clientId)
    const files = await readdir(clientDir, { withFileTypes: true })

    for (const f of files) {
      if (!f.isFile()) continue
      total++
      const key = `${clientId}/${f.name}`
      try {
        const buffer = await readFile(path.join(clientDir, f.name))
        await s.set(key, buffer)
        ok++
        console.log(`  ✓ ${key} (${buffer.length} bytes)`)
      } catch (e) {
        failed++
        console.error(`  ✗ ${key}: ${e.message}`)
      }
    }
  }

  console.log(`\nDone. ${ok}/${total} files uploaded to Netlify Blobs${failed ? `, ${failed} failed` : ''}.`)
  if (failed > 0) process.exitCode = 1
}

main().catch((e) => { console.error(e); process.exit(1) })
