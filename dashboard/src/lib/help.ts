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
      'How commodities typically behave across the calendar year — which ' +
      'months they tend to rise or fall — built from the average move in each ' +
      'month across all years of history. Select one or more commodities to ' +
      'compare their seasonal patterns and anticipate recurring cost swings.',
    howToRead: [
      'Use the Commodities menu to pick one or more (Select all / Clear for ' +
        'speed); your choice is remembered across sessions and devices.',
      'Typical seasonal pattern draws one line per commodity — the average ' +
        'month-over-month % change per calendar month. They are percentages, ' +
        'so different metals compare cleanly on one axis.',
      'The year-over-year overlay shows each selected commodity in its own ' +
        'colour — current year solid, previous year dotted. These are ' +
        'absolute prices, so it reads best comparing similar-scale ' +
        'commodities.',
      'Confidence is labelled by how many years of history exist — treat a ' +
        'low-confidence read as indicative only.',
    ],
  },
  'cost-impact': {
    title: 'Cost impact',
    description:
      'Translates commodity price moves into the effect on YOUR product ' +
      'cost. Pick a company and a product (recipe) and the weights come ' +
      'straight from its BOM — kg of each commodity per kg of product; or ' +
      'choose Custom weights to enter them by hand. The report multiplies ' +
      'each commodity’s quarterly change by that weight and sums it into a ' +
      'single per-unit cost impact.',
    howToRead: [
      'Pick a product to pull weights from its recipe (read-only), or ' +
        'Custom weights to type them in the table (saved to your account). ' +
        'You can select any company shared with you, read-only.',
      'Each commodity’s latest quarter is compared to its trailing ' +
        'rolling baseline to get a net change.',
      'Impact / kg = net change × weight; the headline "Sum of impact" is ' +
        'the total per-unit cost change (red = costlier, green = cheaper).',
    ],
  },
  'spreads': {
    title: 'Spread monitor',
    description:
      'The price gap between commodities over time, against its own normal ' +
      'range. Handy for substitution and sourcing decisions — e.g. scrap vs ' +
      'pig iron, or the same alloy across two markets — where the ' +
      'relationship matters more than either absolute price. Compare one or ' +
      'several commodities against a common reference.',
    howToRead: [
      'Pick a reference commodity (the "vs" selector), then one or more to ' +
        'Compare (Select all / Clear available); each line is Compare − ' +
        'reference. Your selection is remembered.',
      'With a single comparison you also get the mean (dashed) ±1σ band and ' +
        'a deviation tile — how many σ the latest spread is from its mean ' +
        '(beyond ±2σ is flagged as unusual).',
      'With several, each spread is its own line for side-by-side comparison ' +
        '(the band/tiles show only in the single-comparison case).',
    ],
  },
  'companies': {
    title: 'Companies & materials',
    description:
      'Model the companies you work with and the materials each ' +
      'manufactures. A material is a recipe measured in grams per kg of ' +
      'finished product — how many grams of each commodity go into 1 kg, ' +
      'base metallics plus trace additions for melting loss. It is the input ' +
      'to the Guidance report. You can also share a company read-only.',
    howToRead: [
      'Add a company, then add materials to it. (Creating your own companies ' +
        'is a premium feature.)',
      'Enter each commodity in grams per kg — base metallics plus trace ' +
        'additions (ferro-alloys, inoculants) that offset melting loss. The ' +
        '% on the right is that commodity’s share of a kilogram (grams ÷ ' +
        '1000). A recipe need not total 1000 g: the balance to 1 kg is ' +
        'melting loss / burn-off, not missing data.',
      'Blended cost is the mass-weighted average price — the ₹ cost of 1 kg ' +
        'of the finished material at the latest commodity prices.',
      'Share read-only: click Share on a company and invite by email. The ' +
        'invitee gets a link (and an email) to VIEW — not edit — that ' +
        'company’s materials and its charts/guidance, limited to its ' +
        'commodities. They can’t create their own companies unless premium.',
      'Track each invite (Waiting → Accepted, or Expired) and Resend, ' +
        'Re-invite, or Revoke anytime. Invitations expire after 7 days. An ' +
        'invited person who is already a user switches to the shared company ' +
        'via the "view as" selector at the top — no second account.',
      'Everything is private to your account and synced across your devices.',
    ],
  },
  'guidance': {
    title: 'Purchasing guidance',
    description:
      'Actionable, statistical guidance for one or more of your materials: ' +
      'how blended cost is trending, when in the year it is typically ' +
      'cheapest to buy, and which commodities have a cheaper same-unit ' +
      'alternative right now. A decision starting point built from history ' +
      'and current prices — not a forecast.',
    howToRead: [
      'Pick a company, then one or more Materials (Select all / Clear). The ' +
        'blended-cost-over-time chart overlays one line per material; your ' +
        'selection is remembered.',
      'Each selected material gets its own card: current blended cost vs its ' +
        '1-quarter baseline, seasonal buy-timing (weighted by each ' +
        'commodity’s ' +
        'share), and cheaper same-unit substitutions with the per-kg saving.',
      'A coloured dot on each card matches its line in the chart above.',
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
    'The ₹ cost of 1 kg of finished material — the mass-weighted average of ' +
    'its commodities’ current prices, i.e. Σ(grams × price) ÷ Σ(grams).',
  'Consumption weight':
    'How much of a commodity (kg) goes into one unit of your product — ' +
    'taken from the selected product’s recipe (BOM), or entered by hand in ' +
    'Custom mode.',
  'Tier':
    'core = master sheet + dashboards; extended = dashboards only; ' +
    'archived = captured to storage but hidden from reports.',
  'Substitution group':
    'A set of interchangeable commodities (e.g. Ferro Silicon across ' +
    'markets); guidance compares same-unit members to find the cheapest.',
} as const;
