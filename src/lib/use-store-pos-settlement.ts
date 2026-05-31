'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { fetchApi } from '@/lib/api-client'
import {
  addNativeReceiptPrintCallbackListener,
  buildNativeReceiptPrintRequest,
  dispatchNativeReceiptPrint,
} from '@/lib/receipt-printing/native-print-bridge'
import { buildStorePosReceiptPrintPayload } from '@/lib/receipt-printing/store-pos-payload'
import {
  buildStorePosReceiptPrintFailureMessage,
  type StorePosCartItem,
  type SubmittedStorePosOrder,
} from '@/lib/store-pos-ui'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import type {
  NativeReceiptBridgeCallbackPayload,
  PublicStorePosOrderStatusResponse,
} from '@/types/api-payloads'

type UseStorePosSettlementArgs = {
  submittedOrder: SubmittedStorePosOrder | null
  setSubmittedOrder: Dispatch<SetStateAction<SubmittedStorePosOrder | null>>
  cartItems: StorePosCartItem[]
  storeName: string
  publicToken: string
  onResetForNextCustomer: () => void
}

export function useStorePosSettlement({
  submittedOrder,
  setSubmittedOrder,
  cartItems,
  storeName,
  publicToken,
  onResetForNextCustomer,
}: UseStorePosSettlementArgs) {
  const [countdownSeconds, setCountdownSeconds] = useState(10)
  const [waitingSettlement, setWaitingSettlement] = useState(false)
  const [settlementMessage, setSettlementMessage] = useState<string | null>(null)
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false)
  const [isSettlementComplete, setIsSettlementComplete] = useState(false)
  const printedOrderIdsRef = useRef<Set<string>>(new Set())
  const pendingPrintOrderIdsRef = useRef<Set<string>>(new Set())
  const requestToOrderIdRef = useRef<Map<string, string>>(new Map())
  const onResetForNextCustomerRef = useRef(onResetForNextCustomer)

  useEffect(() => {
    onResetForNextCustomerRef.current = onResetForNextCustomer
  }, [onResetForNextCustomer])

  const resetSettlement = useCallback(() => {
    setCountdownSeconds(10)
    setWaitingSettlement(false)
    setSettlementMessage(null)
    setIsPrintingReceipt(false)
    setIsSettlementComplete(false)
    printedOrderIdsRef.current.clear()
    pendingPrintOrderIdsRef.current.clear()
    requestToOrderIdRef.current.clear()
  }, [])

  const dispatchCustomerReceiptPrint = useCallback(
    (order: SubmittedStorePosOrder) => {
      if (printedOrderIdsRef.current.has(order.order_id)) {
        return
      }

      if (pendingPrintOrderIdsRef.current.has(order.order_id)) {
        return
      }

      const payload = buildStorePosReceiptPrintPayload({
        storeName,
        orderId: order.order_id,
        orderNumber: order.order_number,
        orderedAt: order.ordered_at,
        totalAmount: order.total_amount,
        items: cartItems.map((item) => ({
          order_item_id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total_amount: item.line_total,
          options: item.selected_options.flatMap((group) =>
            group.choices.map((choice) => ({
              option_group_name: group.group_name,
              option_choice_name: choice.choice_name,
              price_delta: choice.price_delta,
            }))
          ),
        })),
      })

      const request = buildNativeReceiptPrintRequest({
        payload,
        mode: 'ios_webview_wrapper',
        intent: 'auto_print',
        origin: 'store_pos',
      })

      pendingPrintOrderIdsRef.current.add(order.order_id)
      requestToOrderIdRef.current.set(request.request_id, order.order_id)
      const dispatchResult = dispatchNativeReceiptPrint(request)

      if (!dispatchResult.dispatched) {
        pendingPrintOrderIdsRef.current.delete(order.order_id)
        requestToOrderIdRef.current.delete(request.request_id)
        setIsPrintingReceipt(false)
        setSettlementMessage(
          'お支払いは完了しましたが、この画面では自動でレシート印刷できません。店員の方はPOS用iPadアプリで開いているか確認してください。必要に応じて注文管理画面から再印刷してください。10秒後に次の注文画面へ戻ります。'
        )
        setIsSettlementComplete(true)
        return
      }

      setIsPrintingReceipt(true)
      setSettlementMessage('レシート印刷を開始しています。印刷が終わるまでこのままお待ちください。')
    },
    [cartItems, storeName]
  )

  useEffect(() => {
    if (!submittedOrder) return
    if (submittedOrder.status !== 'cancelled' && !isSettlementComplete) return

    setCountdownSeconds(10)
    const intervalId = window.setInterval(() => {
      setCountdownSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId)
          onResetForNextCustomerRef.current()
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isSettlementComplete, submittedOrder])

  useEffect(() => {
    if (!submittedOrder) return
    if (submittedOrder.payment_status === 'paid' || submittedOrder.status === 'cancelled') return
    setWaitingSettlement(true)
    setIsPrintingReceipt(false)
    setIsSettlementComplete(false)
    setSettlementMessage('店員が会計確認を行っています。料金受領またはキャンセル後に自動で次の注文へ進みます。')
  }, [submittedOrder])

  useEffect(() => {
    const removeListener = addNativeReceiptPrintCallbackListener((payload: NativeReceiptBridgeCallbackPayload) => {
      const orderId = requestToOrderIdRef.current.get(payload.request_id)
      if (!orderId) return
      if (!submittedOrder || submittedOrder.order_id !== orderId) return

      if (payload.status === 'accepted') {
        setIsPrintingReceipt(true)
        setSettlementMessage('レシート印刷を開始しています。印刷が終わるまでこのままお待ちください。')
        return
      }

      pendingPrintOrderIdsRef.current.delete(orderId)
      requestToOrderIdRef.current.delete(payload.request_id)
      setIsPrintingReceipt(false)

      if (payload.status === 'printed') {
        printedOrderIdsRef.current.add(orderId)
        setSettlementMessage('レシートを印刷しました。10秒後に次の注文画面へ戻ります。')
        setWaitingSettlement(false)
        setIsSettlementComplete(true)
        return
      }

      if (payload.status === 'failed') {
        setSettlementMessage(buildStorePosReceiptPrintFailureMessage(payload.error_message))
        setWaitingSettlement(false)
        setIsSettlementComplete(true)
        return
      }

      if (payload.status === 'unsupported') {
        setSettlementMessage(
          'お支払いは完了しましたが、この端末では自動印刷に対応していません。店員の方はPOS用iPadアプリで開いているか確認してください。必要に応じて注文管理画面から再印刷してください。10秒後に次の注文画面へ戻ります。'
        )
        setWaitingSettlement(false)
        setIsSettlementComplete(true)
      }
    })

    return removeListener
  }, [submittedOrder])

  useLiveRefresh({
    enabled:
      !!submittedOrder &&
      submittedOrder.payment_status !== 'paid' &&
      submittedOrder.status !== 'cancelled',
    intervalMs: 2000,
    minGapMs: 900,
    run: async () => {
      if (!submittedOrder) return

      try {
        const response = await fetchApi<PublicStorePosOrderStatusResponse>(
          `/api/public/store-pos/orders/${submittedOrder.order_id}?public_token=${encodeURIComponent(publicToken)}`,
          {
            cache: 'no-store',
          }
        )

        setSubmittedOrder((current) =>
          current
            ? {
                ...current,
                payment_status: response.payment_status as SubmittedStorePosOrder['payment_status'],
                status: response.status as SubmittedStorePosOrder['status'],
                paid_at: response.paid_at,
                cancelled_at: response.cancelled_at,
              }
            : current
        )

        if (response.status === 'cancelled') {
          setSettlementMessage('店員が注文をキャンセルしました。10秒後に次の注文画面へ戻ります。')
          setWaitingSettlement(false)
          setIsPrintingReceipt(false)
          setIsSettlementComplete(true)
          return
        }

        if (response.payment_status === 'paid') {
          setSettlementMessage('店員が料金受領を記録しました。レシート印刷を確認しています。')
          setWaitingSettlement(false)
        }
      } catch {
        // Keep polling; temporary fetch failure should not break the kiosk flow.
      }
    },
  })

  useEffect(() => {
    if (!submittedOrder) return
    if (submittedOrder.status === 'cancelled') return
    if (submittedOrder.payment_status !== 'paid') return
    if (printedOrderIdsRef.current.has(submittedOrder.order_id)) return
    if (pendingPrintOrderIdsRef.current.has(submittedOrder.order_id)) return
    if (isSettlementComplete) return
    dispatchCustomerReceiptPrint(submittedOrder)
  }, [dispatchCustomerReceiptPrint, isSettlementComplete, submittedOrder])

  return {
    countdownSeconds,
    waitingSettlement,
    settlementMessage,
    isPrintingReceipt,
    isSettlementComplete,
    resetSettlement,
  }
}
