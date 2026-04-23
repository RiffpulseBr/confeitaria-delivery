import { getApiBaseUrl } from '../config'

export function currency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export async function parseJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, options)
  const data = await parseJson(response)

  if (!response.ok) {
    const message =
      (typeof data?.detail === 'string' && data.detail) ||
      (typeof data?.detail?.message === 'string' && data.detail.message) ||
      data?.message ||
      `Falha na requisicao ${path}.`
    const error = new Error(message)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}
