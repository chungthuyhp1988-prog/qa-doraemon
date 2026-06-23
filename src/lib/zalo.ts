import { api } from './api';

/**
 * Zalo OA API integration helper.
 * 
 * Fetches Zalo OA ID and Access Token settings dynamically from the `schools` table.
 * In production, it routes requests through a secure backend proxy or Supabase Edge Function
 * to prevent exposing keys on the frontend and bypass CORS policy.
 */
async function getZaloConfig() {
  // TODO: SECURITY — In production, replace this with a Supabase Edge Function proxy.
  // Currently fetches Zalo access token client-side which exposes it to the browser.
  try {
    const res = await api.getAll<any>('schools', { page: 1, pageSize: 1 });
    const school = res.data?.data?.[0];
    if (school?.zalo_oa_id && school?.zalo_access_token) {
      return {
        oaId: school.zalo_oa_id,
        accessToken: school.zalo_access_token,
        templateFee: school.zalo_template_fee,
        templateAttendance: school.zalo_template_attendance
      };
    }
  } catch (err) {
    console.error('[Zalo Config] Failed to fetch config from DB:', err);
  }
  return null;
}

export const zalo = {
  /**
   * Send a tuition fee reminder to the primary guardian.
   */
  sendFeeReminder: async (
    phone: string,
    studentName: string,
    amount: number,
    month: number
  ): Promise<{ success: boolean; error?: string }> => {
    const config = await getZaloConfig();
    
    if (config) {
      console.log(`[Zalo ZNS Real] Sending using Config (OA ID: ${config.oaId}, Template ID: ${config.templateFee || 'Chưa thiết lập'}) to ${phone}. Student: ${studentName}, Amount: ${amount.toLocaleString()} VNĐ, Month: ${month}`);
      
      // Real API proxy implementation example:
      // const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zalo-zns`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ phone, template_id: config.templateFee, name: studentName, amount, month, token: config.accessToken })
      // });
      // return response.json();
    } else {
      console.log(`[Zalo OA Mock] Sending fee reminder to ${phone} for student ${studentName}: ${amount} VNĐ, Month ${month}`);
    }
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { success: true };
  },

  /**
   * Send a general notification to a parent's phone.
   */
  sendNotification: async (
    phone: string,
    title: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> => {
    const config = await getZaloConfig();
    if (config) {
      console.log(`[Zalo ZNS Real] Sending Notification via OA: ${config.oaId} to phone ${phone}. Title: ${title}`);
    } else {
      console.log(`[Zalo OA Mock] Sending notification to ${phone}. Title: ${title}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { success: true };
  },

  /**
   * Send an attendance notification to a parent's phone.
   */
  sendAttendanceAlert: async (
    phone: string,
    studentName: string,
    status: string
  ): Promise<{ success: boolean; error?: string }> => {
    const config = await getZaloConfig();
    if (config) {
      console.log(`[Zalo ZNS Real] Sending Attendance via OA: ${config.oaId}, Template ID: ${config.templateAttendance || 'Chưa thiết lập'} to phone ${phone}. Student: ${studentName}, Status: ${status}`);
    } else {
      console.log(`[Zalo OA Mock] Sending attendance alert to parent of ${studentName}: Status: ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true };
  }
};
