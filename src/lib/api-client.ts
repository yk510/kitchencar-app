import { getApiErrorMessage, isApiFailure, type ApiResponse } from '@/types/api'

export class ApiClientError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

export async function fetchApi<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const json: ApiResponse<T> = await response.json()

  if (!response.ok || isApiFailure(json)) {
    throw new ApiClientError(
      getApiErrorMessage(json, `API request failed with status ${response.status}`),
      response.status
    )
  }

  return json.data
}
