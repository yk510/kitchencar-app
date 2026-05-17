import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'

type VendorMobileOrderRouteContext = {
  supabase: any
  user: { id: string }
}

type VendorMobileOrderRouteAuthResult =
  | { response: Response; context?: undefined }
  | { response?: undefined; context: VendorMobileOrderRouteContext }

type VendorMobileOrderErrorMap = {
  badRequest?: string[]
  notFound?: string[]
  conflict?: string[]
}

type VendorMobileOrderRouteHandlerResult<T> = T | Response

type VendorMobileOrderRouteHandler<T> = (
  context: VendorMobileOrderRouteContext
) => Promise<VendorMobileOrderRouteHandlerResult<T>>

type VendorMobileOrderJsonRouteHandler<TBody, TResponse> = (
  context: VendorMobileOrderRouteContext,
  body: TBody
) => Promise<VendorMobileOrderRouteHandlerResult<TResponse>>

export async function requireVendorMobileOrderRouteContext(
  req: NextRequest
): Promise<VendorMobileOrderRouteAuthResult> {
  const auth = await requireRouteSession(req)
  if (auth.response) return { response: auth.response }

  if (auth.session.role !== 'vendor') {
    return { response: apiError('ベンダー権限が必要です', 403) }
  }

  return {
    context: {
      supabase: auth.session.supabase,
      user: auth.session.user,
    },
  }
}

export function toVendorMobileOrderRouteError(
  scope: string,
  error: unknown,
  map?: VendorMobileOrderErrorMap
) {
  console.error(scope, error)
  const message = error instanceof Error ? error.message : 'サーバーエラー'

  if (map?.badRequest?.includes(message)) {
    return apiError(message, 400)
  }
  if (map?.notFound?.includes(message)) {
    return apiError(message, 404)
  }
  if (map?.conflict?.includes(message)) {
    return apiError(message, 409)
  }

  return apiError(message)
}

export async function executeVendorMobileOrderRoute<T>(
  req: NextRequest,
  scope: string,
  handler: VendorMobileOrderRouteHandler<T>,
  map?: VendorMobileOrderErrorMap
) {
  const resolved = await requireVendorMobileOrderRouteContext(req)
  if (resolved.response) return resolved.response

  try {
    const result = await handler(resolved.context)
    return result instanceof Response ? result : apiOk(result)
  } catch (error) {
    return toVendorMobileOrderRouteError(scope, error, map)
  }
}

export async function executeVendorMobileOrderJsonRoute<TBody, TResponse>(
  req: NextRequest,
  scope: string,
  handler: VendorMobileOrderJsonRouteHandler<TBody, TResponse>,
  map?: VendorMobileOrderErrorMap
) {
  return executeVendorMobileOrderRoute(req, scope, async (context) => {
    const body = (await req.json()) as TBody
    return handler(context, body)
  }, map)
}
