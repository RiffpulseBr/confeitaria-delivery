import { createClient } from '@supabase/supabase-js'

const runtimeConfig = {
  apiBaseUrl: import.meta.env.VITE_API_URL || window.location.origin,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
}

let supabaseClientInstance = null

export async function loadRuntimeConfig() {
  try {
    const response = await fetch('/api/runtime-config')
    if (!response.ok) {
      return runtimeConfig
    }

    const data = await response.json()
    runtimeConfig.apiBaseUrl = data.apiBaseUrl || runtimeConfig.apiBaseUrl
    runtimeConfig.supabaseUrl = data.supabaseUrl || runtimeConfig.supabaseUrl
    runtimeConfig.supabaseAnonKey = data.supabaseAnonKey || runtimeConfig.supabaseAnonKey
  } catch (error) {
    console.error('Erro ao carregar configuracao de runtime:', error)
  }

  return runtimeConfig
}

export function getRuntimeConfig() {
  return runtimeConfig
}

export function getApiBaseUrl() {
  return runtimeConfig.apiBaseUrl || window.location.origin
}

export function getSupabaseClient() {
  if (supabaseClientInstance) {
    return supabaseClientInstance
  }

  if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
    throw new Error('Supabase nao configurado para o frontend em runtime.')
  }

  supabaseClientInstance = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey)
  return supabaseClientInstance
}
