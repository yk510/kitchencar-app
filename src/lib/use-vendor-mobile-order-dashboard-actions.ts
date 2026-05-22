"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, fetchApi } from "@/lib/api-client";
import {
  addNativeReceiptPrintCallbackListener,
  dispatchNativeReceiptPrint,
} from "@/lib/receipt-printing/native-print-bridge";
import { getNotificationTypeLabel } from "@/lib/vendor-mobile-order-notification-copy";
import { STATUS_LABELS } from "@/lib/vendor-mobile-order-order-list";
import type {
  MobileOrderNotificationRow,
  NativeReceiptBridgeCallbackPayload,
  VendorMobileOrderPrintDispatchPayload,
  VendorMobileOrderDashboardOrder,
  VendorMobileOrderListItem,
  VendorMobileOrderOrderMutationPayload,
} from "@/types/api-payloads";

function buildReceiptPrintFollowupMessage(
  errorMessage: string,
  isReprint: boolean,
) {
  if (errorMessage.includes("WebView ラッパーアプリ内で開いてください")) {
    return `${isReprint ? "再印刷" : "自動印刷"}は、POS用iPad の WebView ラッパーアプリ内で実行してください。PC や通常のブラウザからは Bluetooth 印刷できません。`;
  }

  if (errorMessage.includes("プリンター接続先")) {
    return `${isReprint ? "再印刷" : "自動印刷"}に失敗しました。モバイルオーダー設定でプリンター接続先を確認してください。`;
  }

  if (
    errorMessage.includes("Bluetooth") ||
    errorMessage.includes("bluetooth") ||
    errorMessage.includes("プリンター接続") ||
    errorMessage.includes("ペアリング")
  ) {
    return `${isReprint ? "再印刷" : "自動印刷"}に失敗しました。POS用iPad のラッパーアプリでプリンター接続状態を確認してから、もう一度お試しください。`;
  }

  if (
    errorMessage.includes("接続できませんでした") ||
    errorMessage.includes("タイムアウト") ||
    errorMessage.includes("送信に失敗しました")
  ) {
    return `${isReprint ? "再印刷" : "自動印刷"}に失敗しました。プリンターの電源、同じネットワークへの接続、接続先URLを確認してから再試行してください。`;
  }

  return `${isReprint ? "再印刷" : "自動印刷"}に失敗しました。設定確認後にもう一度お試しください。`;
}

type UseVendorMobileOrderDashboardActionsArgs = {
  orders: VendorMobileOrderListItem[];
  counts: {
    placed: number;
    preparing: number;
    ready: number;
    picked_up: number;
    total: number;
  };
  selectedOrder: VendorMobileOrderDashboardOrder | null;
  selectedScheduleId: string | null;
  dashboardStoreId: string | null;
  setMessage: (message: string | null) => void;
  setError: (message: string | null) => void;
  setOrders: (orders: VendorMobileOrderListItem[]) => void;
  setCounts: (counts: {
    placed: number;
    preparing: number;
    ready: number;
    picked_up: number;
    total: number;
  }) => void;
  setSelectedOrder: (order: VendorMobileOrderDashboardOrder | null) => void;
  updateOrderInList: (
    orderId: string,
    updater: (order: VendorMobileOrderListItem) => VendorMobileOrderListItem,
  ) => void;
  updateSelectedOrderDetail: (
    orderId: string,
    updater: (
      order: VendorMobileOrderDashboardOrder,
    ) => VendorMobileOrderDashboardOrder,
  ) => void;
  refreshSummary: (scheduleId: string | null) => Promise<void>;
  refreshList: (
    scheduleId: string | null,
    storeId: string,
    responseScheduleId: string | null,
  ) => Promise<void>;
  loadSelectedOrder: (orderId: string | null) => Promise<void>;
};

export function useVendorMobileOrderDashboardActions({
  orders,
  counts,
  selectedOrder,
  selectedScheduleId,
  dashboardStoreId,
  setMessage,
  setError,
  setOrders,
  setCounts,
  setSelectedOrder,
  updateOrderInList,
  updateSelectedOrderDetail,
  refreshSummary,
  refreshList,
  loadSelectedOrder,
}: UseVendorMobileOrderDashboardActionsArgs) {
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [pendingPaymentReceiptOrderId, setPendingPaymentReceiptOrderId] =
    useState<string | null>(null);
  const [pendingNotificationId, setPendingNotificationId] = useState<
    string | null
  >(null);
  const [pendingReprintOrderId, setPendingReprintOrderId] = useState<
    string | null
  >(null);

  const pendingNativePrintRequestsRef = useRef(
    new Map<
      string,
      { orderId: string; orderNumber: string; isReprint: boolean }
    >(),
  );

  useEffect(() => {
    return addNativeReceiptPrintCallbackListener(
      (payload: NativeReceiptBridgeCallbackPayload) => {
        const context = pendingNativePrintRequestsRef.current.get(
          payload.request_id,
        );
        if (!context) return;

        if (payload.status === "accepted") {
          setMessage(
            context.isReprint
              ? `注文 ${context.orderNumber} の再印刷要求を iPad アプリへ送信しました`
              : `注文 ${context.orderNumber} の料金受領を記録し、レシート印刷要求を iPad アプリへ送信しました`,
          );
          return;
        }

        pendingNativePrintRequestsRef.current.delete(payload.request_id);
        if (context.isReprint) {
          setPendingReprintOrderId((current) =>
            current === context.orderId ? null : current,
          );
        } else {
          setPendingPaymentReceiptOrderId((current) =>
            current === context.orderId ? null : current,
          );
        }

        if (payload.status === "printed") {
          setMessage(
            context.isReprint
              ? `注文 ${context.orderNumber} のレシートを再印刷しました`
              : `注文 ${context.orderNumber} の料金受領を記録し、レシートを印刷しました`,
          );
          return;
        }

        setError(
          buildReceiptPrintFollowupMessage(
            payload.error_message ?? "不明なエラー",
            context.isReprint,
          ),
        );
      },
    );
  }, [setError, setMessage]);

  const refreshOrderSurface = useCallback(
    async (orderId: string) => {
      if (!dashboardStoreId) {
        await loadSelectedOrder(orderId);
        return;
      }

      await Promise.all([
        refreshSummary(selectedScheduleId),
        refreshList(selectedScheduleId, dashboardStoreId, selectedScheduleId),
        loadSelectedOrder(orderId),
      ]);
    },
    [
      dashboardStoreId,
      loadSelectedOrder,
      refreshList,
      refreshSummary,
      selectedScheduleId,
    ],
  );

  const dispatchNativeReceiptRequest = useCallback(
    (
      response: VendorMobileOrderPrintDispatchPayload,
      orderId: string,
      orderNumber: string,
      isReprint: boolean,
    ) => {
      if (response.delivery !== "native_bridge") {
        return false;
      }

      const dispatchResult = dispatchNativeReceiptPrint(
        response.native_request,
      );
      if (!dispatchResult.dispatched) {
        throw new Error("iPad WebView ラッパーアプリ内で開いてください");
      }

      pendingNativePrintRequestsRef.current.set(
        response.native_request.request_id,
        {
          orderId,
          orderNumber,
          isReprint,
        },
      );

      setMessage(
        isReprint
          ? `注文 ${orderNumber} の再印刷要求を iPad アプリへ送信しました`
          : `注文 ${orderNumber} の料金受領を記録し、レシート印刷要求を iPad アプリへ送信しました`,
      );

      return true;
    },
    [setMessage],
  );

  const handleChangeStatus = useCallback(
    async (orderId: string, orderNumber: string, nextStatus: string) => {
      setPendingStatus(nextStatus);
      setMessage(null);
      const previousOrders = orders;
      const previousCounts = counts;
      const previousSelectedOrder = selectedOrder;

      updateOrderInList(orderId, (current) => ({
        ...current,
        status: nextStatus as VendorMobileOrderListItem["status"],
        updated_at: new Date().toISOString(),
        ...(nextStatus === "picked_up"
          ? { picked_up_at: new Date().toISOString() }
          : {}),
        ...(nextStatus === "cancelled"
          ? { cancelled_at: new Date().toISOString() }
          : {}),
      }));
      updateSelectedOrderDetail(orderId, (current) => ({
        ...current,
        status: nextStatus as VendorMobileOrderDashboardOrder["status"],
        updated_at: new Date().toISOString(),
        ...(nextStatus === "picked_up"
          ? { picked_up_at: new Date().toISOString() }
          : {}),
        ...(nextStatus === "cancelled"
          ? { cancelled_at: new Date().toISOString() }
          : {}),
      }));

      try {
        await fetchApi<VendorMobileOrderOrderMutationPayload>(
          `/api/vendor/mobile-order/orders/${orderId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          },
        );
        setMessage(
          `注文 ${orderNumber} を「${STATUS_LABELS[nextStatus]}」に更新しました`,
        );
        void refreshOrderSurface(orderId);
      } catch (err) {
        setOrders(previousOrders);
        setCounts(previousCounts);
        setSelectedOrder(previousSelectedOrder);
        setError(
          err instanceof ApiClientError
            ? err.message
            : "注文ステータスの更新に失敗しました",
        );
      } finally {
        setPendingStatus(null);
      }
    },
    [
      counts,
      orders,
      refreshOrderSurface,
      selectedOrder,
      setCounts,
      setError,
      setMessage,
      setOrders,
      setSelectedOrder,
      updateOrderInList,
      updateSelectedOrderDetail,
    ],
  );

  const handleSendNotification = useCallback(
    async (orderId: string, notification: MobileOrderNotificationRow) => {
      setPendingNotificationId(notification.id);
      setMessage(null);

      try {
        const updatedNotification = await fetchApi<MobileOrderNotificationRow>(
          `/api/vendor/mobile-order/orders/${orderId}/notifications/${notification.id}/send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );

        setMessage(
          `${getNotificationTypeLabel(notification.notification_type)}を処理しました（結果: ${updatedNotification.delivery_status}）`,
        );
        await loadSelectedOrder(orderId);
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : "通知送信に失敗しました",
        );
      } finally {
        setPendingNotificationId(null);
      }
    },
    [loadSelectedOrder, setError, setMessage],
  );

  const handleReceivePayment = useCallback(
    async (orderId: string, orderNumber: string) => {
      setPendingPaymentReceiptOrderId(orderId);
      setMessage(null);
      const previousOrders = orders;
      const previousCounts = counts;
      const previousSelectedOrder = selectedOrder;
      const optimisticPaidAt = new Date().toISOString();

      updateOrderInList(orderId, (current) => ({
        ...current,
        payment_status: "paid",
        paid_at: optimisticPaidAt,
        updated_at: optimisticPaidAt,
      }));
      updateSelectedOrderDetail(orderId, (current) => ({
        ...current,
        payment_status: "paid",
        paid_at: optimisticPaidAt,
        updated_at: optimisticPaidAt,
      }));

      try {
        const response = await fetchApi<VendorMobileOrderOrderMutationPayload>(
          `/api/vendor/mobile-order/orders/${orderId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "receive_payment" }),
          },
        );

        if (response.receipt_print?.attempted) {
          if (
            response.receipt_print.delivery === "native_bridge" &&
            response.receipt_print.native_request
          ) {
            try {
              dispatchNativeReceiptRequest(
                {
                  order_id: orderId,
                  order_number: orderNumber,
                  is_reprint: false,
                  printer_provider: "ios_webview_wrapper",
                  printer_endpoint: "",
                  printer_label: null,
                  print_mode: null,
                  delivery: "native_bridge",
                  native_request: response.receipt_print.native_request,
                },
                orderId,
                orderNumber,
                false,
              );
            } catch (dispatchError) {
              setMessage(
                `注文 ${orderNumber} の料金受領を記録しました。${buildReceiptPrintFollowupMessage(
                  dispatchError instanceof Error
                    ? dispatchError.message
                    : "不明なエラー",
                  false,
                )}`,
              );
            }
          } else if (response.receipt_print.printed) {
            setMessage(
              `注文 ${orderNumber} の料金受領を記録し、レシートを印刷しました`,
            );
          } else {
            setMessage(
              `注文 ${orderNumber} の料金受領を記録しました。${buildReceiptPrintFollowupMessage(response.receipt_print.error_message ?? "不明なエラー", false)}`,
            );
          }
        } else {
          setMessage(`注文 ${orderNumber} の料金受領を記録しました`);
        }

        void refreshOrderSurface(orderId);
      } catch (err) {
        setOrders(previousOrders);
        setCounts(previousCounts);
        setSelectedOrder(previousSelectedOrder);
        setError(
          err instanceof ApiClientError
            ? err.message
            : "料金受領の更新に失敗しました",
        );
      } finally {
        const hasPendingNativeBridgeRequest = Array.from(
          pendingNativePrintRequestsRef.current.values(),
        ).some(
          (entry) => entry.orderId === orderId && entry.isReprint === false,
        );
        if (!hasPendingNativeBridgeRequest) {
          setPendingPaymentReceiptOrderId(null);
        }
      }
    },
    [
      counts,
      dispatchNativeReceiptRequest,
      orders,
      refreshOrderSurface,
      selectedOrder,
      setCounts,
      setError,
      setMessage,
      setOrders,
      setSelectedOrder,
      updateOrderInList,
      updateSelectedOrderDetail,
    ],
  );

  const handleReprintReceipt = useCallback(
    async (orderId: string, orderNumber: string) => {
      setPendingReprintOrderId(orderId);
      setMessage(null);

      try {
        const response = await fetchApi<VendorMobileOrderPrintDispatchPayload>(
          `/api/vendor/mobile-order/orders/${orderId}/print`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_reprint: true }),
          },
        );

        if (
          !dispatchNativeReceiptRequest(response, orderId, orderNumber, true)
        ) {
          setMessage(`注文 ${orderNumber} のレシートを再印刷しました`);
        }
      } catch (err) {
        const errorMessage =
          err instanceof ApiClientError
            ? err.message
            : "レシートの再印刷に失敗しました";
        setError(buildReceiptPrintFollowupMessage(errorMessage, true));
      } finally {
        const hasPendingNativeBridgeRequest = Array.from(
          pendingNativePrintRequestsRef.current.values(),
        ).some(
          (entry) => entry.orderId === orderId && entry.isReprint === true,
        );
        if (!hasPendingNativeBridgeRequest) {
          setPendingReprintOrderId(null);
        }
      }
    },
    [dispatchNativeReceiptRequest, setError, setMessage],
  );

  return {
    pendingStatus,
    pendingPaymentReceiptOrderId,
    pendingNotificationId,
    pendingReprintOrderId,
    handleChangeStatus,
    handleSendNotification,
    handleReceivePayment,
    handleReprintReceipt,
  };
}
