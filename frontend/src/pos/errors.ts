import axios from "axios";
import type { ApiErrorBody } from "@/lib/apiClient";

export const POS_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "انتهت جلسة الخادم. سجّل الدخول مجدداً؛ العمليات محفوظة وستُزامن بعد الدخول.",
  TABLE_OCCUPIED: "الطاولة مشغولة. اختر طاولة متاحة أو افتح طلبها الحالي.",
  TABLE_DISABLED: "الطاولة معطلة. اختر طاولة نشطة أو اطلب من المدير تفعيلها.",
  ORDER_NOT_FOUND: "الطلب غير موجود محلياً أو على الخادم. حدّث البيانات وتحقق من الطاولة.",
  ORDER_NOT_OPEN: "الطلب لم يعد مفتوحاً لهذا الإجراء. راجع حالته قبل المتابعة.",
  INVALID_ORDER_STATE: "حالة الطلب لا تسمح بهذا الإجراء. حدّث الطلب وتحقق من الفواتير المرتبطة.",
  VERSION_CONFLICT: "تغيّر الطلب في جهاز أو تبويب آخر. لم تُحذف بياناتك؛ حدّث الحالة وأعد المحاولة.",
  INVALID_QUANTITY: "الكمية غير صالحة أو تتجاوز الكمية المتاحة للتقسيم.",
  INVALID_MODIFIER_SELECTION: "اختيارات الحجم أو الإضافات غير مكتملة. راجع الخيارات المطلوبة.",
  INVALID_PAYMENT_TOTAL: "قيمة الدفعة النقدية لا تساوي المبلغ المتبقي.",
  INVALID_CASH_TENDER: "المبلغ النقدي المستلم أقل من الجزء النقدي المطلوب.",
  DISCOUNT_NOT_ALLOWED: "هذا الإجراء يحتاج صلاحية المدير العام. اطلب منه تسجيل الدخول.",
  SHIFT_REQUIRED: "افتح وردية لهذا الكاشير والجهاز قبل تسجيل الدفعة.",
  SHIFT_ALREADY_OPEN: "توجد وردية مفتوحة بالفعل لهذا الكاشير والجهاز.",
  SHIFT_NOT_OPEN: "لا توجد وردية مفتوحة قابلة للإغلاق على هذا الجهاز.",
  INVOICE_NOT_FOUND: "الفاتورة غير موجودة. حدّث سجل الفواتير أو ابحث برقمها.",
  INVOICE_ALREADY_PAID: "الفاتورة مدفوعة مسبقاً. لا تُنشئ دفعة أخرى.",
  INVOICE_ALREADY_VOIDED: "الفاتورة ملغاة مسبقاً ولا تقبل هذا الإجراء.",
  REFUND_EXCEEDS_AVAILABLE: "قيمة المرتجع تتجاوز المبلغ المتاح للترجيع.",
  SYNC_DEPENDENCY_MISSING: "عملية سابقة مطلوبة لم تصل بعد. أعد الاتصال ثم اضغط إعادة المحاولة.",
  SYNC_CONFLICT: "حدث تعارض أثناء المزامنة. لم يتم حذف العملية. راجع التفاصيل أو أعد المحاولة.",
  SYNC_SEQUENCE_CONFLICT: "اكتشف النظام تعارضاً في تسلسل عمليات الجهاز. ستُعاد ترقيم العملية تلقائياً دون حذفها.",
  CONFLICT: "يوجد تعارض دائم في البيانات. لم تُحذف العملية؛ راجع حالتها قبل تكرارها.",
  DEVICE_NOT_AUTHORIZED: "هذا الجهاز غير مصرح أو تم تعطيله. أعد المصادقة والإقران عبر المدير.",
  OFFLINE_CAPABILITY_EXPIRED: "انتهت صلاحية العمل دون اتصال. اتصل بالإنترنت وأعد المصادقة والإقران.",
  PERMISSION_DENIED: "لا تملك صلاحية تنفيذ هذا الإجراء.",
  BACKEND_UNAVAILABLE: "الخادم غير متاح. استمر محلياً عند الحاجة ثم أعد المحاولة بعد عودة الاتصال.",
  RESERVATION_OVERLAP: "يوجد حجز متداخل على الطاولة المختارة. اختر طاولة أو وقتاً آخر.",
};

export function posErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError<ApiErrorBody>(error)) return error.response?.data?.error?.code;
  if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") return (error as { code: string }).code;
  if (error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)) return error.message;
  return undefined;
}

export function posErrorMessage(error: unknown, fallback = "تعذر إكمال العملية. تحقق من الحالة وأعد المحاولة."): string {
  const code = posErrorCode(error);
  if (code && POS_ERROR_MESSAGES[code]) return POS_ERROR_MESSAGES[code];
  if (axios.isAxiosError(error) && !error.response) return POS_ERROR_MESSAGES.BACKEND_UNAVAILABLE;
  return fallback;
}
