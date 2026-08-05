// File storage abstraction — backed by Netlify Blobs in production/deploy
// (since serverless functions have ephemeral filesystems and can't keep a
// local uploads/ folder), and falling back to the local filesystem during
// local development if no Netlify Blobs context is available.
//
// Documents are stored under the key `${clientId}/${storedName}` inside a
// single "documents" store — mirroring the previous uploads/{clientId}/ layout.

import { getStore } from '@netlify/blobs'
import { mkdir, readFile, writeFile, unlink } from 'fs/promises'
import path from 'path'

const STORE_NAME = 'documents'
const LOCAL_DIR = path.join(process.cwd(), 'uploads')

function key(clientId: string, storedName: string) {
  return `${clientId}/${storedName}`
}

/**
 * Carpeta donde vive el archivo de un documento. Los documentos cuelgan de un
 * cliente o de un contacto de la agenda; se guarda bajo el id que tengan.
 */
export function docScope(doc: { clientId: string | null; contactId: string | null }): string {
  const scope = doc.clientId ?? doc.contactId
  if (!scope) throw new Error('El documento no pertenece a ningún cliente ni contacto')
  return scope
}

function hasBlobsEnv() {
  // Netlify injects these automatically in deployed environments.
  return !!(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY)
}

function store() {
  return getStore({ name: STORE_NAME, consistency: 'strong' })
}

export async function saveFile(clientId: string, storedName: string, buffer: Buffer): Promise<void> {
  if (hasBlobsEnv()) {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
    await store().set(key(clientId, storedName), arrayBuffer)
    return
  }
  const dir = path.join(LOCAL_DIR, clientId)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, storedName), buffer)
}

export async function readFileBuffer(clientId: string, storedName: string): Promise<Buffer> {
  if (hasBlobsEnv()) {
    const arrBuf = await store().get(key(clientId, storedName), { type: 'arrayBuffer' })
    if (!arrBuf) throw new Error('not found')
    return Buffer.from(arrBuf)
  }
  return readFile(path.join(LOCAL_DIR, clientId, storedName))
}

export async function deleteFile(clientId: string, storedName: string): Promise<void> {
  if (hasBlobsEnv()) {
    await store().delete(key(clientId, storedName))
    return
  }
  await unlink(path.join(LOCAL_DIR, clientId, storedName)).catch(() => null)
}
