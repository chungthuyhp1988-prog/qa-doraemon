import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zalo-send`;

async function callZaloFunction(
  body: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Chưa đăng nhập' };

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi kết nối Zalo',
    };
  }
}

export const zalo = {
  sendFeeReminder: (
    phone: string,
    studentName: string,
    amount: number,
    month: number,
  ) =>
    callZaloFunction({
      type: 'fee_reminder',
      phone,
      student_name: studentName,
      amount,
      month,
    }),

  sendNotification: (phone: string, title: string, content: string) =>
    callZaloFunction({
      type: 'notification',
      phone,
      title,
      content,
    }),

  sendAttendanceAlert: (
    phone: string,
    studentName: string,
    status: string,
  ) =>
    callZaloFunction({
      type: 'attendance',
      phone,
      student_name: studentName,
      status,
    }),
};
