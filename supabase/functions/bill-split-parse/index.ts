import { corsHeaders } from '../_shared/cors.ts'
import { requireBillSplitUser } from '../_shared/billSplitAuth.ts'

const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5'

// Mirrors the tmobile-bill-split skill's steps 2-3a: extract every line's
// charges and the account-level bucket, pooling each voice tier's baseline
// plan+tax cost into the account bucket so only genuine per-line usage
// overage and add-ons (equipment, protection plans) stay personal.
const SYSTEM_PROMPT = `You read T-Mobile family plan PDF bills and extract structured billing data.

Read the whole bill, not just a summary page — the per-line breakdown and the
account-level charges/adjustments are often on different pages.

For each phone number on the bill, determine whether it's a voice, data-only,
or wearable line (usually clear from the plan name or device next to it).

Voice lines need special handling: whatever plan tier a voice line is on, the
plan cost and its standard regulatory taxes/fees are identical for every line
on that tier — they are not a reflection of that person's usage, so they do
NOT belong to that person individually. For each voice tier on the bill:
1. Find that tier's baseline total (plan charge + standard taxes/fees) using
   a line with no extra usage this month.
2. Add baseline × (number of lines on that tier) as one entry in
   account_charges, e.g. {"description": "Voice plan baseline (3 lines x $XX.XX)", "amount": ...}.
3. Each voice line's own "amount" in the lines array is ONLY what's left after
   removing that baseline: usage overage (roaming, per-minute charges) plus
   any equipment installment or protection/insurance plan billed against that
   line. If a voice line's total equals its tier's baseline exactly, its
   amount is 0.

Data-only and wearable lines are not pooled — their full charge (including
their own taxes) is their own "amount" in the lines array as-is.

Everything not tied to one specific phone number (taxes & surcharges bucket,
autopay/loyalty discount, promotional credits, one-time fees) goes into
account_charges as its own entry. Discounts and credits are negative amounts.

If a charge's category is genuinely ambiguous (e.g. a discount that might be
per-line rather than account-wide), make your best-effort classification but
add a plain-English note about it to the "notes" array so a human can review it.

Respond with ONLY a single JSON object, no markdown fences, no commentary,
matching exactly this shape:
{
  "billing_period": "YYYY-MM or a short human label like 'Jul 2 - Aug 1, 2026'",
  "bill_total": 245.67,
  "lines": [
    {"phone_number": "...1234", "line_type": "voice", "amount": 12.00}
  ],
  "account_charges": [
    {"description": "Taxes & surcharges", "amount": 28.50}
  ],
  "notes": ["any ambiguous classification you want a human to double check"]
}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireBillSplitUser(req)
    if (!auth.ok) return auth.response
    const { supabase, userId } = auth

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response('Bill parsing is not configured (missing ANTHROPIC_API_KEY)', {
        status: 500,
        headers: corsHeaders,
      })
    }

    let body: { pdfBase64?: string }
    try {
      body = await req.json()
    } catch {
      return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
    }
    if (!body.pdfBase64) {
      return new Response('pdfBase64 is required', { status: 400, headers: corsHeaders })
    }

    let anthropicRes: Response
    try {
      // A full multi-page bill can take a while for the model to read and
      // classify. Bound it well under the platform's own request timeout so
      // a slow call fails with a clear message instead of a bare 502.
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: body.pdfBase64 },
                },
                { type: 'text', text: 'Extract this T-Mobile bill as the JSON object described in your instructions.' },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(100_000),
      })
    } catch (e) {
      const timedOut = e instanceof Error && e.name === 'TimeoutError'
      console.error('bill-split-parse: Anthropic fetch failed', e)
      return new Response(
        timedOut
          ? 'Bill parsing timed out reading the PDF. Try again, or a shorter bill.'
          : `Bill parsing failed to reach Anthropic: ${e instanceof Error ? e.message : String(e)}`,
        { status: 502, headers: corsHeaders }
      )
    }

    if (!anthropicRes.ok) {
      const text = await anthropicRes.text()
      console.error('bill-split-parse: Anthropic API error', anthropicRes.status, text)
      return new Response(`Bill parsing failed (${anthropicRes.status}): ${text}`, {
        status: 502,
        headers: corsHeaders,
      })
    }

    const anthropicJson = await anthropicRes.json()
    const rawText: string = anthropicJson.content?.[0]?.text ?? ''

    if (anthropicJson.stop_reason === 'max_tokens') {
      console.error('bill-split-parse: response truncated at max_tokens', rawText)
      return new Response(
        "The model's response was cut off before finishing (this bill may have too many lines). Try again.",
        { status: 502, headers: corsHeaders }
      )
    }

    let extracted: {
      billing_period: string
      bill_total: number
      lines: { phone_number: string; line_type: 'voice' | 'data' | 'wearable'; amount: number }[]
      account_charges: { description: string; amount: number }[]
      notes: string[]
    }
    try {
      // Strip markdown fences if present, then take the outermost {...} in
      // case the model added any stray prose before or after the JSON.
      const fenceStripped = rawText.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
      const start = fenceStripped.indexOf('{')
      const end = fenceStripped.lastIndexOf('}')
      if (start === -1 || end === -1 || end < start) throw new Error('no JSON object found')
      extracted = JSON.parse(fenceStripped.slice(start, end + 1))
    } catch (e) {
      console.error('bill-split-parse: could not parse model response', e, rawText)
      return new Response(`Could not parse the model's response as JSON:\n\n${rawText}`, {
        status: 502,
        headers: corsHeaders,
      })
    }

    const { data: associations, error: assocError } = await supabase
      .from('bill_split_associations')
      .select('phone_number, person_name, email, line_type')
      .eq('user_id', userId)
    if (assocError) {
      console.error('bill-split-parse: could not load associations', assocError)
      return new Response(`Could not load saved line associations: ${assocError.message}`, {
        status: 500,
        headers: corsHeaders,
      })
    }

    const associationByNumber = new Map((associations ?? []).map((a) => [a.phone_number, a]))

    const lines = (extracted.lines ?? []).map((line) => {
      const known = associationByNumber.get(line.phone_number)
      return {
        ...line,
        person_name: known?.person_name ?? null,
        email: known?.email ?? null,
        matched: !!known,
      }
    })

    return new Response(
      JSON.stringify({
        billing_period: extracted.billing_period,
        bill_total: extracted.bill_total,
        lines,
        account_charges: extracted.account_charges ?? [],
        notes: extracted.notes ?? [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('bill-split-parse: unhandled error', e)
    return new Response(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`, {
      status: 500,
      headers: corsHeaders,
    })
  }
})
