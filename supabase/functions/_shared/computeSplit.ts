// Direct TS port of the tmobile-bill-split skill's compute_split.py compute(),
// so the in-app split can never disagree with the skill's own math.

export type BillLine = { number: string; type: 'voice' | 'data' | 'wearable'; amount: number }
export type BillPerson = { name: string; email: string; lines: BillLine[] }
export type AccountCharge = { description: string; amount: number }

export type ComputeInput = {
  billing_period: string
  bill_total?: number | null
  people: BillPerson[]
  account_charges: AccountCharge[]
}

export type SplitRow = {
  name: string
  email: string
  linesDesc: string
  lineSubtotal: number
  accountShare: number
  total: number
}

export type ComputeResult = {
  rows: SplitRow[]
  grandTotal: number
  accountTotal: number
  reconciled: boolean | null // null when there's no bill_total to check against
  mismatchCents: number | null
}

const TOLERANCE_CENTS = 2

function cents(amount: number): number {
  return Math.round(amount * 100)
}

export function computeSplit(data: ComputeInput): ComputeResult {
  const { people, account_charges: accountCharges } = data
  if (!people || people.length === 0) {
    throw new Error('No people in input — nothing to split.')
  }

  const n = people.length
  const accountTotal = accountCharges.reduce((s, c) => s + c.amount, 0)
  const accountTotalCents = cents(accountTotal)
  // Python's `//` floors toward -Infinity, unlike JS's default truncating division.
  const shareCents = Math.floor(accountTotalCents / n)
  const shareRemainder = accountTotalCents - shareCents * n

  const rows: SplitRow[] = people.map((person, i) => {
    const lines = person.lines ?? []
    const lineSubtotalCents = lines.reduce((s, l) => s + cents(l.amount), 0)
    const thisShareCents = shareCents + (i < shareRemainder ? 1 : 0)
    const totalCents = lineSubtotalCents + thisShareCents
    const linesDesc = lines
      .map((l) => `${l.number} (${l.type[0].toUpperCase()}${l.type.slice(1)})`)
      .join(', ')

    return {
      name: person.name,
      email: person.email,
      linesDesc,
      lineSubtotal: lineSubtotalCents / 100,
      accountShare: thisShareCents / 100,
      total: totalCents / 100,
    }
  })

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  let reconciled: boolean | null = null
  let mismatchCents: number | null = null
  if (data.bill_total != null) {
    mismatchCents = Math.abs(cents(grandTotal - data.bill_total))
    reconciled = mismatchCents <= TOLERANCE_CENTS
  }

  return { rows, grandTotal, accountTotal, reconciled, mismatchCents }
}
