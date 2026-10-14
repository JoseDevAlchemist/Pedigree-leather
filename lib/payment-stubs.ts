/**
 * Payment stubs — replace with real integrations when credentials are ready.
 *
 * These functions simulate the real payment flow with a delay, so the UI
 * can be built and tested without live credentials. When you have M-Pesa
 * Daraja and Flutterwave credentials, replace these implementations.
 */

export interface MpesaResult {
  ok: boolean;
  reference?: string;
  error?: string;
}

export interface CardResult {
  ok: boolean;
  checkoutUrl?: string;
  error?: string;
}

/**
 * M-Pesa STK Push initiation.
 *
 * REAL IMPLEMENTATION:
 * 1. Receive orderId and customer phone number
 * 2. Look up order total from database
 * 3. Generate STK push request to Safaricom Daraja API:
 *    - POST to https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest
 *    - Headers: Authorization: Bearer <access_token>
 *    - Body: {
 *        BusinessShortCode: <shortcode>,
 *        Password: <base64 encoded (shortcode + passkey + timestamp)>,
 *        Timestamp: <YYYYMMDDHHMMSS>,
 *        TransactionType: "CustomerPayBillOnline",
 *        Amount: <order total in KES>,
 *        PartyA: <customer phone in 2547XXXXXXXX format>,
 *        PartyB: <shortcode>,
 *        PhoneNumber: <customer phone in 2547XXXXXXXX format>,
 *        CallBackURL: <your webhook URL>,
 *        AccountReference: <order_number>,
 *        TransactionDesc: "Payment for order <order_number>"
 *      }
 * 4. Daraja responds with CheckoutRequestID
 * 5. Save CheckoutRequestID to order record for callback matching
 * 6. Return { ok: true, reference: CheckoutRequestID }
 *
 * CALLBACK HANDLING (separate webhook endpoint):
 * 1. Safaricom POSTs to your CallBackURL with ResultCode, ResultDesc, CheckoutRequestID
 * 2. If ResultCode === 0: update orders.payment_status = 'paid', orders.status = 'paid'
 * 3. If ResultCode !== 0: update orders.payment_status = 'failed'
 * 4. Customer's payment page polls /api/orders/[id]/status
 * 5. When status changes to 'paid', redirect to /order/[orderId]
 */
export async function initiateMpesaPayment(
  orderId: string,
  phone: string
): Promise<MpesaResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // In real implementation, this would call Daraja API
  console.log("[stub] M-Pesa STK push initiated for order", orderId, "phone", phone);

  // Simulate success - in real flow, this returns a CheckoutRequestID
  return { ok: true, reference: `STK_${Date.now()}` };
}

/**
 * Card payment initiation (Flutterwave).
 *
 * REAL IMPLEMENTATION:
 * 1. Receive orderId and amount
 * 2. Look up order details (customer email, phone, order_number)
 * 3. Initialize Flutterwave payment:
 *    - POST to https://api.flutterwave.com/v3/payments
 *    - Headers: Authorization: Bearer <secret_key>
 *    - Body: {
 *        tx_ref: <order_number>,
 *        amount: <order total>,
 *        currency: "KES",
 *        redirect_url: <your callback URL>,
 *        customer: { email, phone_number, name },
 *        customizations: { title: "Pedigree Leather", description: "Order payment" },
 *        meta: { order_id: <orderId> }
 *      }
 * 4. Flutterwave returns a payment link
 * 5. Return { ok: true, checkoutUrl: <link> }
 *
 * CALLBACK HANDLING:
 * 1. Flutterwave redirects customer to redirect_url with tx_ref and status
 * 2. Also sends webhook to your webhook URL
 * 3. Verify transaction via Flutterwave API: GET /v3/transactions/{id}/verify
 * 4. If verified: update orders.payment_status = 'paid', orders.status = 'paid'
 * 5. Redirect customer to /order/[orderId]
 */
export async function initiateCardPayment(
  orderId: string,
  amount: number
): Promise<CardResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  console.log("[stub] Card payment initiated for order", orderId, "amount", amount);

  // In real implementation, this returns a Flutterwave checkout URL
  return { ok: true, checkoutUrl: "/order/" + orderId }; // Would be real URL
}

/**
 * Verify M-Pesa payment status by CheckoutRequestID.
 *
 * REAL IMPLEMENTATION:
 * 1. POST to https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query
 * 2. Body: {
 *      BusinessShortCode: <shortcode>,
 *      Password: <base64 encoded (shortcode + passkey + timestamp)>,
 *      Timestamp: <YYYYMMDDHHMMSS>,
 *      CheckoutRequestID: <reference>
 *    }
 * 3. Parse ResultCode from response
 */
export async function verifyMpesaPayment(
  checkoutRequestId: string
): Promise<{ ok: boolean; status: "pending" | "paid" | "failed"; error?: string }> {
  // In real implementation, query Daraja for status
  return { ok: true, status: "pending" };
}