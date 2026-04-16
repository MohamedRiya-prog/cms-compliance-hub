# Compliance Rules — Absolute and Non-Negotiable
## These rules override everything in the product datasheets

---

## RULE 1 — PRODUCT RESPONSE COLUMN: PROPOSED VALUE ONLY
The Product Response column must contain ONLY the single proposed value. NEVER include:
- Standard construction alongside optional (e.g. "standard: X; optional: Y")
- Multiple alternatives (e.g. "X or Y", "X available as option")
- Words: "standard", "optional", "available", "not available", "can be", "may be"
- Any factory test values, reverse static pressure values, or certification test values
- Any comparison between spec value and product value
- Any explanation, justification, or elaboration of why the value complies or does not comply

---

## RULE 2 — PROPOSING STANDARD VS OPTIONAL FEATURES
When spec requires a feature matching a product option (not standard):
- MUST propose that option — do not default to standard
- State ONLY the proposed option in Product Response
- Do not mention standard construction at all
- Example: Spec requires neoprene → product has foam gasket standard, neoprene optional → Product Response: "neoprene, adhesive type" NOT "foam gasket standard; neoprene optional"

---

## RULE 3 — THRESHOLD COMPLIANCE
When spec states a maximum or minimum threshold:
- Product meets or exceeds → Product Response: restate spec value exactly. Remark: "Comply" only
- Product does not meet → Product Response: state actual product operational rated value only
- NEVER write factory test values (e.g. reverse static pressure 9.43 in.wg.) in Product Response or Remark
- The BDD/PRD maximum static pressure rating is 9.43 in.wg. — this ALWAYS exceeds any reasonable spec pressure. When spec says "Maximum system pressure: X", restate X in Product Response and mark Comply

---

## RULE 4 — BDD/PRD: COUNTERWEIGHT VS SPRING (ABSOLUTE)
- Spec mentions spring only → propose spring
- Spec mentions counterweight only → propose counterweight
- Spec mentions BOTH counterweight and spring → propose counterweight ONLY
- NEVER write "counterweight or spring" — always choose one
- Counterweight and spring features: PRD ONLY — BDD is gravity operated only, not applicable

---

## RULE 5 — BDD/PRD: BLADE AND AXLE
- Blade clause → state blade thickness only — never mention shaft
- Axle clause → state axle material only (not size)
- 1.2mm aluminium blade proposed → axle material: galvanized steel
- 0.8mm aluminium blade proposed → axle material: aluminium

---

## RULE 6 — REMARK COLUMN
- Status Comply, no conditions → Remark: "Comply" only — nothing else
- Status Comply, with a genuine condition (e.g. contractor scope caveat, orientation caveat) → state the condition only — do not repeat the product value
- Status Not Comply → state only the gap — do not repeat product value
- Status Noted → Remark: "Not confirmed — datasheet does not specify"
- Status Not Part of Proposal → Remark: "Not part of proposal"

**WRONG (Comply row with extra text):**
Remark: "Comply — UL 555 listed and Civil Defence approved confirmed"
Remark: "Comply — fusible link operates at 74°C; specification requires 72°C; within tolerance"
Remark: "Comply — Style-C proposed (blades out of airstream + 100% free area)"

**CORRECT:**
Remark: "Comply"

**WRONG (Comply row with contractor scope caveat):**
Remark: "Comply"  ← when there IS a genuine condition to flag

**CORRECT (Comply row with contractor scope caveat):**
Remark: "Comply — access doors are contractor scope"

---

## RULE 7 — NOT PART OF PROPOSAL
When a feature is not offered by Excelair at all:
- Product Response: ""
- Status: Not Part of proposal
- Remark: "Not part of proposal"

---

## RULE 8 — OPTIONAL ACCESSORIES (SLEEVES, SCREENS FOR BDD/PRD)
For BDD/PRD sleeves and bird screens (application-dependent accessories):
- Product Response: "Sleeve and bird screen — optional, contractor to specify if required"
- Status: Comply

---

## RULE 9 — FIRE DAMPER MODEL SELECTION (EVFD, EFD, EFSD)
- Spec 1.5 hr or 2 hr → EVFD-10/10D, EFD-140/150, EFSD-141/151 series
- Spec 3 hr → EVFD-30/30D, EFD-340/350, EFSD-341/351 series
- No rating specified → 1.5-hour series as default
- Spec states both 2 hr and 3 hr → propose both models in header
- Spec says "typically X hours" → treat as single rating, propose single model

---

## RULE 10 — EVFD BLADE POSITION
Apply mechanically — do NOT interpret or reason from descriptions:
- Spec says Style-A or Type-A → Style-A
- Spec says Style-B or Type-B → Style-B
- Spec says Style-C or Type-C → Style-C
- Spec says Style-A or Type-A AND Style-B or Type-B → Propose Style-A
- Spec says "blades out of airstream" without specifying Type → Style-B
- Spec says "blades out of airstream" AND "TYPE-C" → Style-C (the explicit type designation overrides the description)

**WRONG:**
Spec says "TYPE-C" → reasoning "blades out of airstream = Style-B" → proposing Style-B

**CORRECT:**
Spec says "TYPE-C" → Style-C. No further reasoning required.

---

## RULE 11 — ESD/EFSD LEAKAGE CLASS
- Spec Class II or III → propose Class I (exceeds requirement)
- Triple-V blade: ESD-141 or EFSD-141/341
- Airfoil blade: ESD-151 or EFSD-151/351
- Remark: Class I proposed; exceeds specified Class II/III requirement

---

## RULE 12 — SLEEVE RULES (EVFD, EFD, EFSD, ESD)
- Always factory installed — never contractor scope
- EVFD: 300mm standard — "300mm standard length — contractor to specify if different length required"
- EFD/EFSD/ESD: 16" (406mm) standard — "16" (406mm) standard length — contractor to specify if different length required"
- 18 gauge = 1.2mm — always state as "1.2mm (18 gauge)"
- Silicone caulking - Comply
- EVFD — Sleeve thickness will be 1.0mm unless specified.

---

## RULE 13 — ACTUATOR NAMING (EFD, EFSD, ESD)
- Multiple on/off models applicable → state general NEMA/IP range only, no specific model names
- Single modulating model → name specifically (Belimo FSAFB24-SR-S)

---

## RULE 14 — MODULATING VS HIGH VELOCITY CONFLICT (EVFD-10D/30D, EFD, EFSD, ESD)
When spec requires both modulating AND 4,000 fpm (cannot be met simultaneously):
- Present both options in header row
- Option 1: Standard (on/off, 4,000 fpm)
- Option 2: Modulating type (2,000 fpm only)
- Address each in relevant clause referencing Option 1 or Option 2

---

## RULE 15 — HS-10 ELECTRIC FUSIBLE LINK (EFSD, EFD motorized)
- Always describe as: "HS-10 electric fusible link rated at 165°F (74°C); factory installed"
- Do NOT say "replaceable" or "resettable"
- Reset switch: standard on ESD/EFSD/EFD motorized — mark Comply
- Test: "Damper tested by supplying power to actuator" — mark Comply
- EFD-140 and EFD-340: fusible link only, reset/test not applicable

---

## RULE 16 — SCOPE SEPARATION
- Manufacturer scope: product materials, construction, ratings, certifications, blade type, frame, seals, actuators, dimensions
- Contractor scope: site installation, access doors, flanged joints, duct sections, mounting execution, BMS wiring, blade position marking on shaft
- Assess manufacturer scope only
- Contractor scope items: Product Response "[item] — contractor scope"; Remark "Contractor scope, not applicable to product compliance"

CRITICAL: Product Response is NEVER blank for contractor scope items. Blank Product Response is ONLY for Rule 7 (Not Part of Proposal).

Mixed clauses (part product feature, part contractor scope): address both in the Product Response — state the product value first, then append "[item] — contractor scope" for the contractor scope sub-item.

WRONG:
Product Response: "Shaft: 3/8" galvanized steel square shaft; Bearings: PVC/Nylon"

CORRECT:
Product Response: "Shaft: 3/8" galvanized steel square shaft; Bearings: PVC/Nylon; blade position marking — contractor scope"
Remark: "Not confirmed — [product-side gap]; blade position marking on shaft is contractor scope, not applicable to product compliance"

---

## RULE 17 — BDD / PRD BLADE OPEN / CLOSE POSITION
- Ignore writing compliance for "Start to open" and "Fully open" — do not split these rows.

---

## RULE 18 — REQUIREMENT COLUMN: VERBATIM FROM SPECIFICATION
- The Requirement column must reproduce the exact wording from the project specification clause, word for word.
- Do NOT paraphrase, summarize, shorten, or reinterpret the specification language.
- If a clause contains sub-items (1, 2, 3...), include all of them exactly as written.

---

## RULE 19 — BURDEN OF PROOF FOR COMPLY (ABSOLUTE)

A clause may ONLY be marked Comply if the datasheet explicitly and unambiguously confirms the requirement. This rule is absolute and overrides any assumption, inference, or reasonable expectation.

Decision logic — apply in order:
1. Find the exact value, statement, or feature in the datasheet that satisfies the requirement.
2. If found and it meets or exceeds the threshold → Comply
3. If found but it does not meet the threshold → Not Comply
4. If the datasheet is silent, vague, or does not explicitly confirm the point → Noted (Remark: "Not confirmed — datasheet does not specify")
5. If the feature does not exist in the product at all → Not Part of Proposal

NEVER mark Comply based on:
- Inference (e.g. "field adjustable implies it can meet the pressure threshold")
- Assumption (e.g. "this is standard practice so it must comply")
- Partial match (e.g. counterweight confirmed but specific opening pressures not confirmed)
- The requirement seeming reasonable or likely to be met

---

## RULE 20 — PRODUCT RESPONSE: NO "NOT CONFIRMED" LANGUAGE

The Product Response column must NEVER contain phrases like:
- "not confirmed in datasheet"
- "to be confirmed with factory"
- "not specified"
- "datasheet does not confirm"

If the datasheet is silent on a point:
- Product Response: state only what the product DOES offer (the closest confirmed feature)
- Status: Noted
- Remark: "Not confirmed — datasheet does not specify"

**WRONG:**
Product Response: "Axle: aluminium; single-piece with bearings not confirmed in datasheet"

**CORRECT:**
Product Response: "Axle: aluminium"
Status: Noted
Remark: "Not confirmed — single-piece axle/bearing construction not confirmed in datasheet"

-----

## RULE 21 — EFSD/ESD VELOCITY-BASED MODEL SELECTION (ABSOLUTE)
When the spec states a minimum open-position air velocity requirement, select the model whose rated velocity meets or exceeds it. Apply this decision logic in order:

Spec requires ≤ 2,000 fpm → propose Triple-V model (EFSD-141/341 or ESD-141) at 2,000 fpm
Spec requires > 2,000 fpm and ≤ 4,000 fpm → propose Airfoil model (EFSD-151/351 or ESD-151) at 4,000 fpm — this meets or exceeds the requirement → Comply
Spec requires > 4,000 fpm → Not Comply — no model available

NEVER default to the 2,000 fpm Triple-V model when the spec requires more than 2,000 fpm and the 4,000 fpm Airfoil model is available and applicable.

-----

## RULE 22 — EFSD FIRE STAT / RELEASING DEVICE: HS-10 vs DUAL TRD (ABSOLUTE)
RULE 22 — EFSD FIRE STAT / RELEASING DEVICE: HS-10 vs DUAL TRD (ABSOLUTE)
Apply this decision logic — one condition only:

Spec requires the damper to remain operable while the temperature is above 350°F → propose Dual TRD DRS-30
No such requirement → propose HS-10 electric fusible link

The HS-10 trips at 165°F and cannot be reset above that temperature. If the spec requires operability above 350°F, only the Dual TRD DRS-30 can satisfy that — no further analysis needed.
When Dual TRD DRS-30 is required:

Product Response: "Dual TRD DRS-30; Primary: 165°F (74°C), Secondary: 350°F (177°C); factory installed"
Status: Comply
Remark: "Comply"

-----

## RULE 23 — MANUFACTURER APPROVAL vs APPLICATION SCOPE (ABSOLUTE)
Not every opening clause (A) is a manufacturer approval clause. Apply this decision logic:

Clause explicitly mentions "manufacturers", "approved list", "approved manufacturers", or "manufacturer's list" → Status: Noted | Remark: "Noted — manufacturer approval subject to project approved manufacturers list"
Clause describes where or for what equipment the product is required (e.g. "Sound attenuators for AHU's, exhaust fans", "Fire dampers for all fire-rated walls") → This is an application scope clause. Product Response: confirm the product is suitable for those applications | Status: Comply | Remark: "Comply"
If the clause contains both a manufacturer reference and application scope, split into two rows — one for each.

NEVER assume the first clause of a section is always a manufacturer approval clause. Read the actual wording.

-----

## RULE 24 — BEST-FIT SELECTION: 

- When the product datasheet offers multiple options (e.g. densities, thicknesses, models), evaluate all options against the specification requirements and propose the option that achieves the highest compliance. Never select arbitrarily."

-----

## RULE 25 — SMACNA COMPLIANCE CLAUSES
- When a specification clause requires fabrication or construction in accordance with SMACNA standards:

Product Response: "Constructed as per the proposed construction against project specification"
Status: Noted
Remark: "Not confirmed — Excelair does not claim SMACNA compliance; constructed as per project specification requirements"

-----

## RULE 26 — ACOUSTIC LOUVER MODEL SELECTION

- When a specification clause requires STC value to be matched, go through the available models and choose the closest or highest STC model and propose.

Example: If specification asks for STC of 13 propose ACL-600

- Do not propose ACL-300 AF unless specification clause specifically asks for airfoil shaped blades.

-------

## RULE 27 — SAND TRAP LOUVER EFFICIENCY

- When specification clause required sand rejection efficiency for particle size of 350-799 microns specify that Excelair louvers are tested for particle sizes smaller than the project requirement, hence rejection efficiency is different.

Product Response: State what the product offers and "Excelair louvers are tested for particle sizes smaller than the project requirement, hence rejection efficiency is different".
Status: "As proposed"

Remark: "Not tested for 350-799 microns separately"

----
