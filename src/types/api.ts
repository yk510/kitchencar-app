export type ApiSuccess<T> = {
  data: T
}

export type ApiFailure = {
  error: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export function isApiFailure<T>(value: ApiResponse<T>): value is ApiFailure {
  return 'error' in value
}

export function getApiErrorMessage<T>(value: ApiResponse<T>, fallback: string) {
  return isApiFailure(value) ? value.error : fallback
}
