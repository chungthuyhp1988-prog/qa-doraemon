import { toast } from '../stores/toastStore';

/**
 * Zalo OA API integration helper.
 * In production, this would make HTTP requests to the Zalo OA API endpoints
 * via a secure backend proxy or Supabase Edge Function to avoid exposing secret tokens.
 */
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
    console.log(`[Zalo OA] Sending fee reminder to ${phone} for student ${studentName}: ${amount} VNĐ, Month ${month}`);
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    // For demo/local build: always succeed
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
    console.log(`[Zalo OA] Sending notification to ${phone}. Title: ${title}`);
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
    console.log(`[Zalo OA] Sending attendance alert to parent of ${studentName}: Status: ${status}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true };
  }
};
