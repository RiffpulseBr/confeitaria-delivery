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
      data?.message ||
      `Falha na requisicao ${path}.`
    throw new Error(message)
  }

  return data
}
