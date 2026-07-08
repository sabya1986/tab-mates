import { corsHeaders } from '../_shared/cors.ts'
import { requireBillSplitUser } from '../_shared/billSplitAuth.ts'

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

type PersonShare = {
  personName: string
  linesDesc: string
  lineSubtotal: number
  accountShare: number
  amountTotal: number
}

// One or more people can share an inbox (e.g. a couple). When they do, this
// renders one section per person plus a combined total, instead of sending
// that inbox a separate email per person.
function renderEmailHtml(opts: { billingPeriod: string; people: PersonShare[] }) {
  const { billingPeriod, people } = opts
  const combinedTotal = people.reduce((s, p) => s + p.amountTotal, 0)

  const sections = people
    .map(
      (p) => `
      <div style="margin-bottom: 18px;">
        <h3 style="margin-bottom: 4px;">${escapeHtml(p.personName)}</h3>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 4px 0; color: #555;">Lines</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(p.linesDesc) || '—'}</td></tr>
          <tr><td style="padding: 4px 0; color: #555;">Line charges</td><td style="padding: 4px 0; text-align: right;">$${p.lineSubtotal.toFixed(2)}</td></tr>
          <tr><td style="padding: 4px 0; color: #555;">Shared account charges</td><td style="padding: 4px 0; text-align: right;">$${p.accountShare.toFixed(2)}</td></tr>
          <tr style="font-weight: 600;">
            <td style="padding: 6px 0;">Subtotal</td><td style="padding: 6px 0; text-align: right;">$${p.amountTotal.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    `
    )
    .join('')

  const summary =
    people.length > 1
      ? `
      <table style="border-collapse: collapse; width: 100%; border-top: 2px solid #333; padding-top: 8px;">
        <tr style="font-weight: 700; font-size: 16px;">
          <td style="padding: 10px 0;">Total owed (${people.length} people)</td>
          <td style="padding: 10px 0; text-align: right;">$${combinedTotal.toFixed(2)}</td>
        </tr>
      </table>
    `
      : ''

  const greeting =
    people.length > 1
      ? `Here's the T-Mobile bill split for ${people.map((p) => escapeHtml(p.personName)).join(' and ')}:`
      : `Here's your share of this month's T-Mobile family plan bill:`

  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">T-Mobile Bill Split — ${escapeHtml(billingPeriod)}</h2>
      <p>${greeting}</p>
      ${sections}
      ${summary}
      <p style="color: #888; font-size: 13px; margin-top: 12px;">Sent automatically from Tab Mates.</p>
    </div>
  `
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    return await handle(req)
  } catch (e) {
    console.error('bill-split-send: unhandled error', e)
    return new Response(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`, {
      status: 500,
      headers: corsHeaders,
    })
  }
})

async function handle(req: Request): Promise<Response> {
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

  // Group shares by email so people sharing one inbox (e.g. a couple) get a
  // single combined email instead of one each.
  const groups = new Map<string, NonNullable<typeof shares>>()
  for (const share of shares ?? []) {
    const key = share.email.trim().toLowerCase()
    const group = groups.get(key)
    if (group) group.push(share)
    else groups.set(key, [share])
  }

  const results: { email: string; sent: boolean; error?: string }[] = []

  for (const groupShares of groups.values()) {
    const toEmail = groupShares[0].email
    const combinedTotal = groupShares.reduce((s, sh) => s + sh.amount_total, 0)

    const html = renderEmailHtml({
      billingPeriod: billSplit.billing_period,
      people: groupShares.map((sh) => ({
        personName: sh.person_name,
        linesDesc: sh.lines_desc,
        lineSubtotal: sh.line_subtotal,
        accountShare: sh.account_share,
        amountTotal: sh.amount_total,
      })),
    })

    const subject =
      groupShares.length > 1
        ? `T-Mobile Bill Split — ${billSplit.billing_period} — $${combinedTotal.toFixed(2)} total (${groupShares.map((sh) => sh.person_name).join(', ')})`
        : `T-Mobile Bill Split — ${billSplit.billing_period} — $${combinedTotal.toFixed(2)}`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: toEmail, subject, html }),
    })

    const shareIds = groupShares.map((sh) => sh.id)
    if (resendRes.ok) {
      await supabase
        .from('bill_split_shares')
        .update({ sent_at: new Date().toISOString(), send_error: null })
        .in('id', shareIds)
      results.push({ email: toEmail, sent: true })
    } else {
      const errText = await resendRes.text()
      await supabase.from('bill_split_shares').update({ send_error: errText }).in('id', shareIds)
      results.push({ email: toEmail, sent: false, error: errText })
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
