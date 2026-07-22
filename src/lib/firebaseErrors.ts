const messages: Record<string, string> = {
  'auth/email-already-in-use': 'هذا البريد مرتبط بحساب موجود بالفعل.',
  'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
  'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
  'auth/network-request-failed': 'تعذر الاتصال. تحقق من الإنترنت وحاول مرة ثانية.',
  'auth/too-many-requests': 'محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول.',
  'auth/user-disabled': 'هذا الحساب موقوف حاليًا.',
  'auth/weak-password': 'اختر كلمة مرور أقوى من 6 أحرف على الأقل.',
  'permission-denied': 'لا تملك صلاحية تنفيذ هذا الإجراء.',
  'firestore/permission-denied': 'لا تملك صلاحية الوصول إلى هذه البيانات.',
  'unavailable': 'الخدمة غير متاحة مؤقتًا. سنعيد المحاولة عند عودة الاتصال.',
  'firestore/unavailable': 'الخدمة غير متاحة مؤقتًا. سنعيد المحاولة عند عودة الاتصال.',
}

const errorCode = (cause: unknown) => {
  if (!cause || typeof cause !== 'object' || !('code' in cause)) return ''
  return String(cause.code)
}

export const getFirebaseErrorMessage = (cause: unknown, fallback = 'حدث خطأ غير متوقع. حاول مرة ثانية.') => {
  const code = errorCode(cause)
  if (messages[code]) return messages[code]
  if (cause instanceof Error && cause.message.trim() && !cause.message.includes('Firebase')) return cause.message
  return fallback
}
