import { corsHeaders } from '../_shared/cors.ts'
import { requireBillSplitUser } from '../_shared/billSplitAuth.ts'
import { computeSplit, type ComputeInput } from '../_shared/computeSplit.ts'

// Input: the finalized split the client built after resolving every line's
// owner (name + email) and reviewing account-level charges. This function
// doesn't call any LLM — it's pure arithmetic plus persistence, so it can be
// re-run safely without burning API calls.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const auth = await requireBillSplitUser(req)
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth

  let input: ComputeInput
  try {
    input = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
  }

  if (!input.billing_period || !Array.isArray(input.people) || input.people.length === 0) {
    return new Response('billing_period and at least one person are required', {
      status: 400,
      headers: corsHeaders,
    })
  }
  for (const person of input.people) {
    if (!person.name?.trim() || !person.email?.trim()) {
      return new Response('Every person needs a name and an email before computing the split', {
        status: 400,
        headers: corsHeaders,
      })
    }
  }

  let result
  try {
    result = computeSplit(input)
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'Could not compute split', {
      status: 400,
      headers: corsHeaders,
    })
  }

  // Remember every line's owner for next month, so the parse step can
  // prefill it without asking again.
  const associationRows = input.people.flatMap((person) =>
    (person.lines ?? []).map((line) => ({
      user_id: userId,
      phone_number: line.number,
      person_name: person.name,
      email: person.email,
      line_type: line.type,
      updated_at: new Date().toISOString(),
    }))
  )
  if (associationRows.length > 0) {
    const { error: assocError } = await supabase
      .from('bill_split_associations')
      .upsert(associationRows, { onConflict: 'user_id,phone_number' })
    if (assocError) {
      return new Response(`Could not save line associations: ${assocError.message}`, {
        status: 500,
        headers: corsHeaders,
      })
    }
  }

  const { data: billSplit, error: billSplitError } = await supabase
    .from('bill_splits')
    .insert({
      created_by: userId,
      billing_period: input.billing_period,
      bill_total: input.bill_total ?? null,
      computed_total: result.grandTotal,
      reconciled: result.reconciled ?? false,
      raw_input: input,
    })
    .select('id')
    .single()

  if (billSplitError || !billSplit) {
    return new Response(`Could not save bill split: ${billSplitError?.message}`, {
      status: 500,
      headers: corsHeaders,
    })
  }

  const shareRows = result.rows.map((r) => ({
    bill_split_id: billSplit.id,
    person_name: r.name,
    email: r.email,
    lines_desc: r.linesDesc,
    line_subtotal: r.lineSubtotal,
    account_share: r.accountShare,
    amount_total: r.total,
  }))

  const { error: sharesError } = await supabase.from('bill_split_shares').insert(shareRows)
  if (sharesError) {
    return new Response(`Could not save shares: ${sharesError.message}`, {
      status: 500,
      headers: corsHeaders,
    })
  }

  return new Response(
    JSON.stringify({
      billSplitId: billSplit.id,
      rows: result.rows,
      grandTotal: result.grandTotal,
      accountTotal: result.accountTotal,
      billTotal: input.bill_total ?? null,
      reconciled: result.reconciled,
      mismatchCents: result.mismatchCents,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
