# Mind Jar Unit Economics Calculator – Guide

## 📊 Quick Summary

The `test.html` file contains an interactive **Unit Economics Calculator** for Mind Jar. It automatically calculates LTV (Lifetime Value), CPI (Cost Per Install), break-even points, ROMI (Return on Marketing Investment), and growth budgets based on your input parameters.

### 🎯 Key Metrics (Default Values)

| **Metric**                | **Value** | **What It Means**                                  |
| ------------------------- | --------- | -------------------------------------------------- |
| **LTV per Install**       | **$4.11** | ⭐ Most important: Average value from each install |
| **Break-even CPI**        | **$4.11** | Maximum you can spend per install (don't exceed!)  |
| **Safe CPI (Target)**     | **$2.06** | ✅ Recommended CPI for sustainable growth          |
| **ROMI @ $2 CPI**         | **2.06×** | Return: $2.06 LTV for every $1 spent on ads        |
| **Profit / 100 installs** | **$211**  | Net profit from 100 installs at $2 CPI             |

### 💡 Calculation Breakdown (Default Values)

**Step 1: Profit Per Payment Cycle**

```
Monthly: $7.99 - $1.20 (Apple 15%) - $0.58 (Tax 8.5%) - $0.07 (RC 1%) - $0.02 (AI) = $6.13
Annual:  $59.99 - $9.00 (Apple 15%) - $4.33 (Tax 8.5%) - $0.51 (RC 1%) - $0.29 (AI) = $45.86
```

**Step 2: LTV Per Payer**

```
Monthly LTV: $6.13 × 6 months = $36.78
Annual LTV:  $45.86 × 2 years = $91.72
Blended LTV: (60% × $36.78) + (40% × $91.72) = $58.74
```

**Step 3: LTV Per Install**

```
LTV/install = $58.74 × 7% = $4.11
```

**Step 4: CPI Guidelines**

```
Break-even: $4.11 (same as LTV/install)
Safe CPI:   $4.11 × 50% = $2.06
Aggressive: $4.11 × 80% = $3.29
```

**Step 5: Growth Budget Example**

```
Current: 20 payers
Target:  20 × 1.20 = 24 payers (+4 new)
Installs: 4 ÷ 7% = 57.14 installs
Budget:  57.14 × $2 = $114.29/month
```

### 📈 Key Features

- Real-time calculations as you change inputs
- Visual charts showing LTV vs conversion rate and profit vs CPI
- Three-step workflow: Pricing → Behavior → Growth
- All calculations update automatically

---

## How to Use the Calculator

### Step 1: Pricing & Cost Structure

This section calculates **how much profit you make from each paid user** (before considering lifetime).

#### Input Fields:

1. **Monthly price ($)** – Your App Store monthly subscription price (e.g., $7.99)
2. **Annual price ($)** – Your App Store annual subscription price (e.g., $59.99)
3. **Apple fee (%)** – Apple's commission (usually 15% or 30%)
4. **Tax on payout (%)** – VAT or other taxes on Apple payout (e.g., 8.5%)
5. **RevenueCat fee (% of payout)** – RevenueCat commission if using their service (e.g., 1%)
6. **AI cost monthly ($)** – AI costs per billed month (e.g., $0.02)
7. **AI cost annual ($)** – AI costs per billed year (e.g., $0.29)
8. **Monthly fixed burn ($)** – Fixed monthly costs (tools, infrastructure, etc., e.g., $59.79)

#### Output KPIs:

- **Profit / monthly billing** – Net profit after Apple, tax, RevenueCat & AI per **one paid month**

  - Formula: `(Monthly Price - Apple Fee - Tax - RevenueCat Fee - AI Cost)`
  - **Example with defaults:** `$7.99 → **$6.13** profit per paid month`
  - Breakdown: $7.99 - $1.20 (Apple 15%) - $0.58 (Tax 8.5%) - $0.07 (RC 1%) - $0.02 (AI) = **$6.13**

- **Profit / annual billing** – Net profit after all deductions per **one paid year**
  - Formula: `(Annual Price - Apple Fee - Tax - RevenueCat Fee - AI Cost)`
  - **Example with defaults:** `$59.99 → **$45.86** profit per paid year`
  - Breakdown: $59.99 - $9.00 (Apple 15%) - $4.33 (Tax 8.5%) - $0.51 (RC 1%) - $0.29 (AI) = **$45.86**

> **Important:** These are **NOT LTV** – they represent profit from a single payment cycle. LTV requires multiplying by average lifetime.

---

### Step 2: Behaviour & Mix

This section calculates **LTV per payer** and **LTV per install** based on user behavior.

#### Input Fields:

1. **Monthly share of payers (%)** – Percentage of users who choose monthly vs annual (e.g., 60%)
2. **Avg lifetime monthly (months)** – Average number of months monthly subscribers pay (e.g., 6)
3. **Avg lifetime annual (years)** – Average number of years annual subscribers continue (e.g., 2)
4. **Install → paying user (%)** – Conversion rate from install to first payment (CR_pay, e.g., 7%)
5. **Test CPI ($)** – Your target CPI to test scenarios (e.g., $2.0)
6. **Current # of payers** – Current number of paying users (for growth calculations)
7. **Target monthly growth (%)** – Desired net growth rate of payers per month (e.g., 20%)
8. **Monthly churn of payers (%)** – Monthly churn rate (optional, set 0 if unknown)

#### Output KPIs:

- **LTV / monthly payer** – Total lifetime value of a monthly subscriber

  - Formula: `Profit per month × Average lifetime months`
  - **Example with defaults:** `$6.13 × 6 months = **$36.78**`
  - This is the total value from one monthly subscriber over their lifetime

- **LTV / annual payer** – Total lifetime value of an annual subscriber

  - Formula: `Profit per year × Average lifetime years`
  - **Example with defaults:** `$45.86 × 2 years = **$91.72**`
  - This is the total value from one annual subscriber over their lifetime

- **Blended LTV / payer** – Weighted average LTV across all payers

  - Formula: `(Monthly Share × LTV_monthly) + (Annual Share × LTV_annual)`
  - **Example with defaults:** `(60% × $36.78) + (40% × $91.72) = **$58.74**`
  - This is your average LTV per paying user (regardless of plan type)

- **LTV / install** – Average LTV generated per installation ⭐ **KEY METRIC**
  - Formula: `Blended LTV per payer × Conversion Rate`
  - **Example with defaults:** `$58.74 × 7% = **$4.11**`
  - **This is your key metric for determining acceptable CPI**
  - If LTV/install = $4.11, you can spend up to $4.11 per install and break even

---

### Step 3: CPI · Break-even · Growth

This section calculates **advertising economics** and **growth budgets**.

#### Output KPIs:

1. **Break-even CPI** – Maximum CPI where you break even (LTV/install = CPI)

   - Formula: `LTV per install`
   - If CPI exceeds this, you're losing money long-term
   - **Example with defaults:** If LTV/install = **$4.11**, break-even CPI = **$4.11**
   - ⚠️ **Warning:** Never exceed this value!

2. **Safe CPI (≈50% of LTV/install)** – Conservative target CPI with good profit margin

   - Formula: `LTV per install × 0.5`
   - **Example with defaults:** `$4.11 × 0.5 = **$2.06**`
   - ✅ **Recommended target** for sustainable growth

3. **Aggressive CPI (≈80% of LTV/install)** – Higher CPI for aggressive scaling

   - Formula: `LTV per install × 0.8`
   - **Example with defaults:** `$4.11 × 0.8 = **$3.29**`
   - ⚡ Use only if you need rapid growth and can accept lower margins

4. **Payers to cover monthly burn (LTV)** – How many new payers (at full LTV) needed to cover fixed burn

   - Formula: `Monthly Burn / Blended LTV per payer`
   - **Example with defaults:** `$59.79 / $58.74 = **1.02 payers**` (rounds to **1 payer**)
   - This shows how many new payers you need to cover your fixed costs long-term

5. **Installs to cover burn (via LTV/install)** – Approximate installs needed to generate LTV equal to monthly burn

   - Formula: `Monthly Burn / LTV per install`
   - **Example with defaults:** `$59.79 / $4.11 = **14.54 installs**` (rounds to **~15 installs**)
   - This shows how many installs you need to cover fixed costs

6. **Growth budget (per month)** – Advertising budget needed to achieve target growth

   - Formula: `(Target New Payers / CR_pay) × CPI`
   - Accounts for churn and growth rate
   - **Example with defaults:** To grow 20% from 20 payers (need +4 payers) with 7% CR and $2 CPI:
     - New payers needed: 4
     - Installs needed: 4 / 0.07 = 57.14
     - Budget: 57.14 × $2 = **$114.29/month**

7. **ROMI @ Test CPI (per $1)** – Return on marketing investment

   - Formula: `LTV per install / Test CPI`
   - **Example with defaults:** `$4.11 / $2.00 = **2.06×**`
   - This means: for every **$1** spent on ads, you get **$2.06** in LTV
   - ✅ Target: ROMI > 1.5× for healthy unit economics

8. **Net profit / 100 installs @ Test CPI** – Profit after ad costs for 100 installs
   - Formula: `(LTV per install × 100) - (CPI × 100)`
   - **Example with defaults:** `($4.11 × 100) - ($2.00 × 100) = **$211 profit**`
   - This shows your profit margin per 100 installs at your test CPI

---

## Charts

### 1. LTV / Install vs Conversion Rate

Shows how **LTV per install** changes as conversion rate varies (1% to 20%), keeping other parameters fixed.

**How to read:**

- X-axis: Conversion rate (%)
- Y-axis: LTV per install ($)
- Higher conversion = higher LTV per install
- Use this to see sensitivity to conversion improvements

### 2. Profit / Install vs CPI

Shows **profit per install** at different CPI levels, based on your current LTV/install.

**How to read:**

- X-axis: CPI ($)
- Y-axis: Profit per install ($)
- Where the line crosses zero = break-even CPI
- Negative values = losing money
- Positive values = profit

---

## Quick Reference: Default Values & Results

> **Based on default calculator inputs:**
>
> - Monthly price: $7.99, Annual price: $59.99
> - Apple fee: 15%, Tax: 8.5%, RevenueCat: 1%
> - AI costs: $0.02/month, $0.29/year
> - Monthly share: 60%, Monthly lifetime: 6mo, Annual lifetime: 2yr
> - Conversion rate: 7%, Test CPI: $2.00
> - Current payers: 20, Growth: 20%, Churn: 0%
> - Monthly burn: $59.79

| Metric                    | Value       | Notes                                  |
| ------------------------- | ----------- | -------------------------------------- |
| **Profit per month**      | **$6.13**   | Net after all fees per paid month      |
| **Profit per year**       | **$45.86**  | Net after all fees per paid year       |
| **LTV monthly payer**     | **$36.78**  | 6 months × $6.13                       |
| **LTV annual payer**      | **$91.72**  | 2 years × $45.86                       |
| **Blended LTV per payer** | **$58.74**  | Weighted average (60/40 mix)           |
| **LTV per install**       | **$4.11**   | ⭐ Key metric for CPI decisions        |
| **Break-even CPI**        | **$4.11**   | Maximum acceptable CPI                 |
| **Safe CPI (50%)**        | **$2.06**   | ✅ Recommended target                  |
| **Aggressive CPI (80%)**  | **$3.29**   | ⚡ For rapid scaling                   |
| **Payers for burn**       | **1.02**    | New payers needed to cover $59.79 burn |
| **Installs for burn**     | **14.54**   | Installs needed to cover burn          |
| **Growth budget**         | **$114.29** | To grow 20% from 20 payers             |
| **ROMI @ $2 CPI**         | **2.06×**   | Return on marketing investment         |
| **Profit / 100 installs** | **$211**    | At $2 CPI                              |

---

## Alignment with Unit Economics Framework

### 1. Profit Per Paid User

**Calculator shows:**

- Profit / monthly billing
- Profit / annual billing

**Matches your framework:**

- Monthly: `$7.99 → **$6.13** profit per paid month` (your framework: ~$6.11)
- Annual: `$59.99 → **$45.86** profit per paid year` (your framework: ~$45.77)

### 2. LTV Calculations

**Calculator shows:**

- LTV / monthly payer
- LTV / annual payer
- Blended LTV / payer

**Matches your framework:**

| Scenario     | Monthly Lifetime | LTV Monthly | Annual Lifetime | LTV Annual |
| ------------ | ---------------- | ----------- | --------------- | ---------- |
| Conservative | 3 months         | ~$18.39     | 1 year          | ~$45.86    |
| **Base**     | **6 months**     | **$36.78**  | **2 years**     | **$91.72** |
| Optimistic   | 9 months         | ~$55.17     | 2 years         | ~$91.72    |

**Blended LTV (60% monthly, 40% annual, 6mo/2yr):**

- Calculator: **$58.74** (60% × $36.78 + 40% × $91.72)
- Your framework: ~$58–60 ✓

### 3. LTV Per Install

**Calculator shows:**

- LTV / install (based on blended LTV × conversion rate)

**Matches your framework:**

| Scenario     | CR_pay | LTV_payer  | LTV/install |
| ------------ | ------ | ---------- | ----------- |
| Conservative | 5%     | ~$23.82    | ~$1.19      |
| **Base**     | **7%** | **$58.74** | **$4.11**   |
| Optimistic   | 10%    | ~$73.27    | ~$7.33      |

> **Note:** Base scenario uses 60% monthly (6mo) + 40% annual (2yr) mix

### 4. CPI / CAC Guidelines

**Calculator shows:**

- Break-even CPI
- Safe CPI (50% of LTV/install)
- Aggressive CPI (80% of LTV/install)

**Matches your framework:**

| Scenario     | LTV/install | Safe CPI (50%) | Aggressive CPI (80%) |
| ------------ | ----------- | -------------- | -------------------- |
| Conservative | ~$1.19      | ~$0.60         | ~$0.95               |
| **Base**     | **$4.11**   | **$2.06**      | **$3.29**            |
| Optimistic   | ~$7.33      | ~$3.66         | ~$5.86               |

**Practical recommendation:** Target CPI **~$2** as baseline (matches base scenario safe CPI of $2.06)

### 5. Burn Coverage

**Calculator shows:**

- Payers to cover monthly burn (LTV)
- Installs to cover burn (via LTV/install)

**Matches your framework:**

- Fixed burn: **$59.79/month**
- With LTV_payer = **$58.74**: Need **1.02 payers** (≈ **1 payer**) to cover burn long-term
- With LTV/install = **$4.11**: Need **14.54 installs** (≈ **15 installs**) to cover burn

### 6. Growth Budget

**Calculator shows:**

- Growth budget (per month) – accounts for churn and target growth

**Matches your framework example:**

- Current: **20 payers**
- Target: **+20% growth** = **+4 new payers/month**
- CR_pay = **7%** → Need **57.14 installs** (4 / 0.07)
- CPI = **$2** → Budget = **$114.29/month** ✓

### 7. ROMI & Profit Examples

**Calculator shows:**

- ROMI @ Test CPI
- Net profit / 100 installs @ Test CPI

**Matches your framework:**

- Base scenario: LTV/install = **$4.11**, CPI = **$2**
- ROMI = **$4.11 / $2 = 2.06×** ✓
- 100 installs profit = (**$4.11** × 100) - (**$2** × 100) = **$211** ✓

---

## Practical Usage Workflow

### 1. Start with Known Values

Fill in **Step 1** with your actual:

- Prices
- Apple fee (15% or 30%)
- Tax rate
- RevenueCat fee
- AI costs
- Fixed burn

### 2. Estimate User Behavior

In **Step 2**, start with conservative estimates:

- Monthly share: 60%
- Monthly lifetime: 6 months
- Annual lifetime: 2 years
- Conversion rate: 5–7% (adjust based on data)
- Test CPI: $2 (your target)

### 3. Analyze Results

Check the KPIs:

- **LTV / install** should be at least 2–3× your target CPI
- **Break-even CPI** shows your maximum acceptable CPI
- **Safe CPI** is your conservative target
- **ROMI** should be > 1.5× for sustainable growth

### 4. Adjust for Growth

Set your:

- Current payers
- Target growth %
- Churn % (if known)

The calculator shows:

- Required growth budget
- Expected ROMI at your test CPI

### 5. Use Charts for Sensitivity

- **LTV vs CR chart:** See how improving conversion affects economics
- **Profit vs CPI chart:** Find your break-even point visually

### 6. Iterate with Real Data

As you collect data, update:

- Actual conversion rates
- Real lifetime values
- Actual churn rates

Recalculate to get accurate LTV and CPI targets.

---

## Key Formulas (Behind the Scenes)

### Profit Per Cycle

```
Monthly: (Price - Apple Fee) × (1 - Tax%) × (1 - RC%) - AI Cost
Annual: (Price - Apple Fee) × (1 - Tax%) × (1 - RC%) - AI Cost
```

### LTV Per Payer

```
Monthly LTV = Profit per month × Lifetime months
Annual LTV = Profit per year × Lifetime years
Blended LTV = (Monthly Share × Monthly LTV) + (Annual Share × Annual LTV)
```

### LTV Per Install

```
LTV/install = Blended LTV per payer × Conversion Rate
```

### CPI Guidelines

```
Break-even CPI = LTV/install
Safe CPI = LTV/install × 0.5
Aggressive CPI = LTV/install × 0.8
```

### Growth Budget

```
Target Payers = Current × (1 + Growth%) - (Current × Churn%)
New Payers Needed = Target Payers - (Current - Churned)
Installs Needed = New Payers / Conversion Rate
Budget = Installs Needed × CPI
```

### ROMI

```
ROMI = LTV per install / CPI
```

---

## Tips & Best Practices

1. **Start conservative:** Use lower conversion rates and shorter lifetimes initially
2. **Monitor real data:** Update inputs as you collect actual user behavior data
3. **Target safe CPI:** Aim for CPI around 50% of LTV/install for sustainable growth
4. **Account for churn:** Include churn rate for accurate growth calculations
5. **Test scenarios:** Adjust conversion rate and lifetime to see impact on economics
6. **Check break-even:** Ensure your test CPI is below break-even CPI
7. **ROMI target:** Aim for ROMI > 1.5× for healthy unit economics

---

## Next Steps

1. **Collect real data:**

   - Actual conversion rates (install → payer)
   - Monthly vs annual plan mix
   - Average lifetime of subscribers
   - Monthly churn rate

2. **Update calculator** with real numbers

3. **Set CPI targets** based on calculated safe/aggressive CPI

4. **Plan growth budgets** using the growth calculator

5. **Monitor and iterate** as your business evolves

---

## Notes

- All calculations assume a **6–12 month horizon** for LTV realization
- The calculator focuses on **subscription revenue only** (not one-time purchases)
- Fixed burn is separate from advertising costs
- Growth calculations account for churn if provided
- Charts update automatically as you change inputs

---

**Built for Mind Jar** – Edit the numbers until you find a comfortable balance between growth and risk.
