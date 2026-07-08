import { corsHeaders } from '../_shared/cors.ts'
import { requireBillSplitUser } from '../_shared/billSplitAuth.ts'

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function renderEmailHtml(opts: {
  personName: string
  billingPeriod: string
  linesDesc: string
  lineSubtotal: number
  accountShare: number
  amountTotal: number
}) {
  const { personName, billingPeriod, linesDesc, lineSubtotal, accountShare, amountTotal } = opts
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">T-Mobile Bill Split — ${escapeHtml(billingPeriod)}</h2>
      <p>Hi ${escapeHtml(personName)},</p>
      <p>Here's your share of this month's T-Mobile family plan bill:</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 6px 0; color: #555;">Your lines</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(linesDesc) || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Line charges</td><td style="padding: 6px 0; text-align: right;">$${lineSubtotal.toFixed(2)}</td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Shared account charges</td><td style="padding: 6px 0; text-align: right;">$${accountShare.toFixed(2)}</td></tr>
        <tr style="border-top: 1px solid #ddd; font-weight: 600;">
          <td style="padding: 10px 0;">Total owed</td><td style="padding: 10px 0; text-align: right;">$${amountTotal.toFixed(2)}</td>
        </tr>
      </table>
      <p style="color: #888; font-size: 13px;">Sent automatically from Tab Mates.</p>
    </div>
  `
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const auth = await requireBillSplitUser(req)
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('BILL_SPLIT_FROM_EMAIL')
  if (!resendKey || !fromEmail) {
    return new Response('Email sending is not configured (missing RESEND_API_KEY or BILL_SPLIT_FROM_EMAIL)', {
      status: 500,
      headers: corsHeaders,
    })
  }

  let body: { billSplitId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
  }
  if (!body.billSplitId) {
    return new Response('billSplitId is required', { status: 400, headers: corsHeaders })
  }

  const { data: billSplit, error: billSplitError } = await supabase
    .from('bill_splits')
    .select('id, billing_period')
    .eq('id', body.billSplitId)
    .single()
  if (billSplitError || !billSplit) {
    return new Response('Bill split not found', { status: 404, headers: corsHeaders })
  }

  // Only send to shares that haven't gone out yet, so retrying after a
  // partial failure doesn't double-email anyone.
  const { data: shares, error: sharesError } = await supabase
    .from('bill_split_shares')
    .select('id, person_name, email, lines_desc, line_subtotal, account_share, amount_total')
    .eq('bill_split_id', billSplit.id)
    .is('sent_at', null)
  if (sharesError) {
    return new Response(`Could not load shares: ${sharesError.message}`, { status: 500, headers: corsHeaders })
  }

  const results: { email: string; sent: boolean; error?: string }[] = []

  for (const share of shares ?? []) {
    const html = renderEmailHtml({
      personName: share.person_name,
      billingPeriod: billSplit.billing_period,
      linesDesc: share.lines_desc,
      lineSubtotal: share.line_subtotal,
      accountShare: share.account_share,
      amountTotal: share.amount_total,
    })

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: share.email,
        subject: `T-Mobile Bill Split — ${billSplit.billing_period} — $${share.amount_total.toFixed(2)}`,
        html,
      }),
    })

    if (resendRes.ok) {
      await supabase
        .from('bill_split_shares')
        .update({ sent_at: new Date().toISOString(), send_error: null })
        .eq('id', share.id)
      results.push({ email: share.email, sent: true })
    } else {
      const errText = await resendRes.text()
      await supabase.from('bill_split_shares').update({ send_error: errText }).eq('id', share.id)
      results.push({ email: share.email, sent: false, error: errText })
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
