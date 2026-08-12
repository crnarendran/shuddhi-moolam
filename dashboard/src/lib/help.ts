// In-product help content (SM-35): the single source of truth for every
// report's inline description + "how to read it", and a shared glossary
// reused by tooltips so terms read identically everywhere.

export interface ReportHelp {
  title: string;
  description: string;
  howToRead: string[];
}

export const REPORT_HELP: Record<string, ReportHelp> = {
  'price-review': {
    title: 'Price Review',
    description:
      'A weekly-into-monthly scan of every tracked commodity: the last few ' +
      'months of average prices and how much each moved most recently, so ' +
      'you can see at a glance which inputs are rising, which are falling, ' +
      'and which need attention this week.',
    howToRead: [
      'Each row is one commodity; the bar shows its latest month-over-month ' +
        '(MoM) % change — green = up, red = down.',
      'The table lists the last three monthly averages plus the change (Δ) ' +
        'and % MoM.',
      'Status: OK (small move), Watch (3–5%), Review (over your threshold) — ' +
        'set the threshold with the slider.',
      'A commodity with no bar simply did not move month-over-month.',
    ],
  },
  'seasonal': {
    title: 'Seasonal analysis',
    description:
      'How a commodity typically behaves across the calendar year — which ' +
      'months it tends to rise or fall — built from the average move in each ' +
      'month across all years of history. Useful for anticipating recurring ' +
      'cost swings rather than reacting to them.',
    howToRead: [
      'Pick a commodity; the chart overlays each year so seasonal patterns ' +
        'line up.',
      'The seasonal index is the average month-over-month % change for each ' +
        'calendar month across years.',
      'Confidence is labelled by how many years of history exist — treat a ' +
        'low-confidence read as indicative only.',
    ],
  },
  'cost-impact': {
    title: 'Cost impact',
    description:
      'Translates commodity price moves into the effect on YOUR product ' +
      'cost. You set how much of each commodity goes into a unit (its ' +
      'consumption weight); the report multiplies each commodity’s ' +
      'quarterly change by that weight and sums it into a single per-unit ' +
      'cost impact.',
    howToRead: [
      'Weight = kg of each commodity per unit of product; edit it in the ' +
        'table (saved to your account).',
      'Each commodity’s latest quarter is compared to its trailing ' +
        'rolling baseline to get a net change.',
      'Impact / kg = net change × weight; the headline "Sum of impact" is ' +
        'the total per-unit cost change (red = costlier, green = cheaper).',
    ],
  },
  'spreads': {
    title: 'Spread monitor',
    description:
      'The price gap between two commodities over time, against its own ' +
      'normal range. Handy for substitution and sourcing decisions — e.g. ' +
      'scrap vs pig iron, or the same alloy across two markets — where the ' +
      'relationship matters more than either absolute price.',
    howToRead: [
      'Pick two commodities; the line is (A − B) each month.',
      'The dashed line is the mean; the shaded band is ±1 standard deviation ' +
        '(the normal range).',
      'The deviation tile shows how many σ the latest spread is from its ' +
        'mean — beyond ±2σ is flagged as unusual.',
    ],
  },
  'companies': {
    title: 'Companies & materials',
    description:
      'Model the companies you work with and the materials each ' +
      'manufactures. A material is a recipe: a set of commodities with a ' +
      'ratio (how much of each goes into a unit). This becomes the input to ' +
      'the Guidance report.',
    howToRead: [
      'Add a company, then add materials to it.',
      'A material’s composition is commodity + ratio rows; the editor ' +
        'shows the live blended cost and each commodity’s % share.',
      'Everything is private to your account and synced across your devices.',
    ],
  },
  'guidance': {
    title: 'Purchasing guidance',
    description:
      'Actionable, statistical guidance for one of your materials: how its ' +
      'blended cost is trending, when in the year it is typically cheapest ' +
      'to buy, and which commodities have a cheaper same-unit alternative ' +
      'right now. It is a decision starting point built from history and ' +
      'current prices — not a forecast.',
    howToRead: [
      'Pick a company + material; tiles show the current blended cost and ' +
        'how it compares to its 6-month baseline.',
      'Seasonal buy-timing lists the months prices typically fall into, ' +
        'weighted by each commodity’s share of the material.',
      'Cheaper alternatives suggest a same-unit substitute and the per-unit ' +
        'saving if you swapped today.',
    ],
  },
  'settings': {
    title: 'Settings',
    description:
      'Choose which commodities appear in your reports. Hide a commodity ' +
      'globally to remove it everywhere, then optionally hide more within a ' +
      'single report for a focused view.',
    howToRead: [
      'Global: toggle a commodity off to hide it from every report.',
      'Per report: within the globally-allowed set, hide more for just that ' +
        'report — a report can never re-show a globally-hidden commodity.',
      'Tiers: core (also in the master sheet), extended (dashboards only), ' +
        'archived (captured but hidden).',
    ],
  },
};

// Shared term definitions used by InfoTip tooltips across reports.
export const GLOSSARY = {
  'MoM %':
    'Month-over-month percent change — this month’s average vs last ' +
    'month’s.',
  'Rolling baseline':
    'A trailing moving average (e.g. the prior few quarters) used as the ' +
    '"normal" level to compare the latest period against.',
  'Seasonal index':
    'The average month-over-month % change for each calendar month across ' +
    'all years — the recurring seasonal pattern.',
  'Spread':
    'The price difference between two commodities (A − B) tracked over time.',
  'Deviation (σ)':
    'How many standard deviations the latest value is from its historical ' +
    'mean; beyond ±2σ is unusual.',
  'Blended cost':
    'A material’s cost = the sum of each commodity’s ratio × its ' +
    'current price.',
  'Consumption weight':
    'How much of a commodity (kg) goes into one unit of your product.',
  'Tier':
    'core = master sheet + dashboards; extended = dashboards only; ' +
    'archived = captured to storage but hidden from reports.',
  'Substitution group':
    'A set of interchangeable commodities (e.g. Ferro Silicon across ' +
    'markets); guidance compares same-unit members to find the cheapest.',
} as const;
