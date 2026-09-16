// Curated multi-turn sales conversations for the offline POC.
// Every technical claim below traces to the catalog description of the referenced
// FGMN; exact values always defer to the linked technical data sheet.

const flows = [
  {
    flowId: "bpa-free-barriers",
    title: "BPA-free clear protective barriers",
    persona: "Fabricator sourcing heavy-gauge clear sheet for hygiene barriers",
    steps: [
      {
        stepId: "01",
        intent: "application_fit",
        scope: "product",
        fgmns: ["71068692"],
        title: "BPA-free clear sheet for protective barriers",
        keywords: [
          "bpa free",
          "barrier",
          "sneeze guard",
          "sheet",
          "clarity",
          "tritan gx100",
        ],
        questions: [
          "I need a BPA-free clear plastic for protective barriers",
          "Which Eastman product is BPA free and clear enough for sneeze guards?",
          "Recommend a BPA-free transparent sheet material",
          "What do you have for BPA free clear barriers and partitions?",
        ],
        answer: `Eastman Tritan GX100 copolyester is the grade I would put in front of you first. It is the one product in this catalog that explicitly calls out being free of materials of concern, including BPA, and it is purpose-built for heavy-gauge sheet.

### Why it fits
- Glasslike clarity, so a barrier still reads as an open, welcoming space.
- Designed for heavy-gauge sheet end uses: sneeze guards, separation barriers, outdoor signs, displays, and in-store fixtures.
- Already used in heat-sensitive environments such as hospitals, office buildings, schools, and retail.
- Explicitly free of materials of concern, including BPA, which is usually the first question your specifier asks.

### TDS checkpoints before you commit
- **Luminous transmittance and haze (ASTM D1003)** — this is what "glasslike clarity" measures out to; haze is the number a specifier will challenge.
- **Notched Izod impact (ASTM D256)** — the barrier has to survive a strike, not just look clear.
- **Heat deflection temperature (ASTM D648)** — read it at both 0.45 MPa and 1.82 MPa; the gap tells you how much margin you have on hot cleaning cycles.
- **Drying and extrusion conditions** — copolyesters must be dried to spec or you get haze and splay in a part sold on clarity.

I will not quote values from memory. Read them off the technical data sheet linked under this answer.

### What I still need from you
Sheet gauge and whether the part is thermoformed or flat-fabricated drive the processing window more than anything else.

### Next step
What gauge range are you fabricating, and is this flat sheet or thermoformed?`,
      },
      {
        stepId: "02",
        intent: "product_comparison",
        scope: "comparison",
        fgmns: ["71068692", "71069060"],
        title: "Tritan GX100 vs Tritan FX200",
        keywords: [
          "compare",
          "gx100",
          "fx200",
          "sheet",
          "film",
          "heat resistance",
        ],
        questions: [
          "How does Tritan GX100 compare with Tritan FX200 for sheet?",
          "Compare Tritan GX100 and Tritan FX200",
          "GX100 versus FX200 which one should I pick?",
          "What is the difference between Tritan GX100 and Tritan FX200?",
        ],
        answer: `Good question, because these two are aimed at different parts of the same market.

### Eastman Tritan GX100 copolyester
- Positioned for heavy-gauge sheet: barriers, signage, displays, fixtures.
- Glasslike clarity and explicitly free of materials of concern, including BPA.
- The right answer when the part is thick, rigid, and visible.

### Eastman Tritan FX200 copolyester
- Positioned for calendered and extruded film where enhanced heat resistance and toughness are required.
- Proven in hot-fill food packaging, transaction and identification cards, and protective laminates.
- The right answer when the part is thin-gauge and sees heat.

### Put them side by side on these lines
| Property | Test method | Why it decides this job |
| --- | --- | --- |
| Heat deflection temperature | ASTM D648 | Hot-fill and cleaning-cycle survival |
| Notched Izod impact | ASTM D256 | Strike and drop resistance on a barrier |
| Haze / luminous transmittance | ASTM D1003 | The clarity claim you are selling |
| Tensile modulus | ASTM D638 | Panel stiffness at your chosen gauge |

### How I would decide
If your barrier is heavy-gauge sheet, stay on GX100. If you are moving into thin protective laminate or a hot-fill structure, FX200 is the better starting point. Pull both technical data sheets — linked below — and compare those four rows before you lock the design.

### Next step
Is this a rigid barrier panel, or are you also laminating a thinner protective film?`,
      },
      {
        stepId: "03",
        intent: "document_guidance",
        scope: "product",
        fgmns: ["71068692"],
        title: "What the Tritan GX100 TDS covers",
        keywords: [
          "tds",
          "technical data sheet",
          "gx100",
          "properties",
          "data",
        ],
        questions: [
          "What does the Tritan GX100 technical data sheet cover?",
          "Show me the TDS data for Tritan GX100",
          "What properties are published for GX100?",
          "Where do I find technical data for Tritan GX100?",
        ],
        answer: `Tritan GX100 has a published technical data sheet, a safety data sheet, and a sales specification. I have linked all of them below this answer so you can pull the numbers straight from the source.

### What to look for in the TDS
- **Mechanical** — tensile strength and modulus (ASTM D638), flexural modulus (ASTM D790), notched Izod impact (ASTM D256). This is where the toughness story is proven.
- **Thermal** — heat deflection temperature (ASTM D648) at 0.45 MPa and 1.82 MPa, plus glass transition temperature. These set your maximum service and cleaning temperature.
- **Optical** — luminous transmittance and haze (ASTM D1003), and yellowness index (ASTM E313) if the barrier lives outdoors.
- **Physical** — specific gravity (ASTM D792), which turns your gauge and panel size into a real shipping weight and a real material cost per panel.
- **Processing** — recommended drying time and temperature, melt temperature range, and extrusion conditions for heavy-gauge sheet.

### How I would use it
Compare the heat deflection value against your disinfection protocol, and the notched Izod value against your drop or strike requirement. Those two decide the grade more often than clarity does. Then use specific gravity to sanity-check your cost per square metre at gauge.

I will not quote numbers from memory — read them off the linked technical data sheet so your design record is defensible.

### Next step
Do you want me to line up GX100 against your cleaning-chemistry and service-temperature requirements?`,
      },
      {
        stepId: "04",
        intent: "conversion",
        scope: "product",
        fgmns: ["71068692"],
        title: "Samples and quotation for Tritan GX100",
        keywords: ["sample", "quote", "pricing", "order", "gx100", "lead time"],
        questions: [
          "Can you send safety documentation and a quote for Tritan GX100?",
          "How do I get samples and pricing for GX100?",
          "I want to move forward with Tritan GX100",
          "Set me up with a quote for Tritan GX100",
        ],
        answer: `Happy to move this forward. Here is how a GX100 evaluation normally runs.

### What happens next
1. **Documents** — the safety data sheet, technical data sheet, and sales specification are linked below; send them straight to your EHS and design reviewers.
2. **Sample request** — use the product inquiry form on the linked product page with your gauge, process, and annual volume. That routes to the commercial team covering your region.
3. **Trial** — run a sheet trial at your stated gauge and confirm clarity and impact on your own line.
4. **Commercial terms** — pricing, lead time, and minimum order quantity come from your Eastman representative, not from this catalog.

### What to include in your inquiry
Sheet gauge, annual volume, target launch date, and the cleaning chemistry the barrier will see. That gets you a useful reply on the first pass instead of a round of questions.

### Next step
Shall I summarise this thread so you can paste it into the product inquiry form?`,
      },
    ],
  },
  {
    flowId: "eyewear-optical",
    title: "Eyewear frames and optical parts",
    persona:
      "Eyewear brand product engineer selecting an optical-grade polymer",
    steps: [
      {
        stepId: "01",
        intent: "application_fit",
        scope: "product",
        fgmns: ["71069225"],
        title: "Optical-grade copolyester for eyewear frames",
        keywords: [
          "eyewear",
          "frames",
          "optical",
          "clarity",
          "impact",
          "tritan vx301",
        ],
        questions: [
          "I'm developing eyewear frames and need an optical grade polymer",
          "Which Eastman polymer works for eyewear frames?",
          "Recommend a material for optical applications like glasses frames",
          "What do you suggest for clear eyewear frame moulding?",
        ],
        answer: `For eyewear frames I would start you on Eastman Tritan VX301 copolyester. It is the grade in this catalog written specifically around optical applications such as eyewear frames.

### Why it fits eyewear
- Amorphous copolyester with excellent clarity — important when the frame front is a styling surface.
- Excellent impact resistance, which is what survives a dropped frame and a hinge snap-fit.
- Outstanding chemical resistance and hydrolytic stability, so sunscreen, sweat, and cleaning solutions do not craze the part.
- Ease of processing, which matters when you are moulding thin temples and thick fronts in the same tool.

### TDS checkpoints for an optical part
- **Luminous transmittance and haze (ASTM D1003)** — the whole value proposition of an optical grade.
- **Refractive index** — needed if the frame carries or indexes against a lens.
- **Notched Izod impact (ASTM D256)** — hinge and snap-fit survival.
- **Mould shrinkage (ASTM D955)** — flow and cross-flow values drive your cavity dimensions.
- **Heat deflection temperature (ASTM D648)** — sets your safe demould and any hard-coat or anti-reflective bake.

### The trade-off to watch
Thick optical sections punish residual stress. Gate placement and hold pressure will matter more than the grade choice.

### Next step
Are you moulding frame fronts, temples, or a full lens-and-frame assembly?`,
      },
      {
        stepId: "02",
        intent: "product_comparison",
        scope: "comparison",
        fgmns: ["71069225", "71069233"],
        title: "Tritan VX301 vs Tritan VX401",
        keywords: ["compare", "vx301", "vx401", "optical", "eyewear", "choice"],
        questions: [
          "Compare Tritan VX301 and Tritan VX401 for optical parts",
          "What is the difference between Tritan VX301 and VX401?",
          "VX301 or VX401 for my optical application?",
          "Tritan VX301 versus Tritan VX401",
        ],
        answer: `These two are siblings, and the difference is scope rather than chemistry family.

### Eastman Tritan VX301 copolyester
- Written specifically around optical applications such as eyewear frames.
- Excellent clarity and impact resistance, outstanding chemical resistance and hydrolytic stability.
- My default when the part genuinely is a frame.

### Eastman Tritan VX401 copolyester
- Same amorphous copolyester story: excellent clarity, impact resistance, chemical resistance, hydrolytic stability, ease of processing.
- Positioned for a broad spectrum of optical applications, not eyewear frames alone.
- My default when you have a family of optical parts — housings, covers, lenses, light guides — and want one grade across them.

### Put them side by side on these lines
| Property | Test method | Why it decides this job |
| --- | --- | --- |
| Melt flow rate | ASTM D1238 | Can one grade fill a thin temple and a thick front? |
| Mould shrinkage, flow and cross-flow | ASTM D955 | Cavity sizing and hinge fit |
| Haze / luminous transmittance | ASTM D1003 | Optical acceptance |
| Notched Izod impact | ASTM D256 | Drop and snap-fit survival |
| Heat deflection temperature | ASTM D648 | Safe demould and hard-coat bake |

### How I would decide
Single eyewear programme, stay on VX301. Multiple optical parts under one qualification, VX401 gives you more room. Flow and shrink differences are real, so compare those rows in the two technical data sheets before you cut steel — both are linked below.

### Next step
Is this one frame programme, or a family of optical parts you want to qualify together?`,
      },
      {
        stepId: "03",
        intent: "sustainability_fit",
        scope: "product",
        fgmns: ["71119266"],
        title: "Recycled content option for eyewear",
        keywords: [
          "recycled content",
          "renew",
          "sustainability",
          "eyewear",
          "vx301 50",
        ],
        questions: [
          "Do you have a recycled content version of VX301?",
          "Is there a sustainable option for eyewear frames?",
          "Which Tritan grade has recycled content for optical parts?",
          "I need a recycled content material for my eyewear range",
        ],
        answer: `Yes — Eastman Tritan Renew VX301-50 copolyester is the sustainability-positioned counterpart to the grade we just discussed.

### Why brands move to it
- Same technical story: amorphous copolyester with excellent clarity and impact resistance.
- Same durability arguments: outstanding chemical resistance, hydrolytic stability, and ease of processing.
- Same target application: optical applications such as eyewear frames.
- The "Renew 50" designation is the recycled content claim your marketing and compliance teams will want documented.

### What I would not overstate
Certified content claims, mass-balance methodology, and any regional recycling label need to come from the formal documentation and your Eastman representative — not from a chat window. Start from the linked product page and technical data sheet.

### Practical advantage
Because it sits alongside VX301 in the same family, brands often qualify both and switch by programme rather than re-tooling.

### The one technical check I insist on
Put the Renew VX301-50 technical data sheet next to the VX301 sheet and compare mould shrinkage (ASTM D955), melt flow rate (ASTM D1238), and haze (ASTM D1003). If those three line up, your existing tool and cycle usually carry across. If shrinkage differs, budget for a tool trial before you commit a launch date.

### Next step
Do you need the recycled content claim substantiated for a specific market or eco-label?`,
      },
      {
        stepId: "04",
        intent: "document_guidance",
        scope: "product",
        fgmns: ["71069225"],
        title: "Reading the Tritan VX301 TDS before tooling",
        keywords: [
          "tds",
          "vx301",
          "tooling",
          "shrinkage",
          "processing",
          "drying",
        ],
        questions: [
          "What should I check in the VX301 TDS before tooling?",
          "Which VX301 technical data matters for mould design?",
          "What processing data is published for Tritan VX301?",
          "Help me read the Tritan VX301 technical data sheet",
        ],
        answer: `Before you cut steel, the technical data sheet is doing four jobs. It is linked below along with the safety data sheet.

### The five numbers that decide your tool
- **Mould shrinkage (ASTM D955)** — read flow and cross-flow separately; optical frames have tight fits at the hinge and lens groove, and anisotropic shrink is what puts them out of tolerance.
- **Melt flow rate (ASTM D1238)** — decides whether you can fill a thin temple from the same gate family as a thick front.
- **Drying conditions** — target moisture is typically well under 0.04% for copolyesters; the sheet gives the grade-specific time and temperature. Under-dried resin shows as haze and splay in a part you are selling on clarity.
- **Heat deflection temperature (ASTM D648)** — sets your safe demould and any downstream coating or hard-coat bake.
- **Specific gravity (ASTM D792)** — turns part volume into shot weight, which is what your moulder quotes against.

### A practical warning
Optical parts fail on residual stress far more often than on resin choice. Plan for generous gating and slow, controlled pack on thick sections.

### Next step
Do you want me to line up VX301 and VX401 on the exact criteria your tool shop is asking for?`,
      },
    ],
  },
  {
    flowId: "paint-protection-film",
    title: "Automotive paint protection film",
    persona: "Automotive accessories buyer sourcing PPF",
    steps: [
      {
        stepId: "01",
        intent: "application_fit",
        scope: "product",
        fgmns: ["71100690"],
        title: "Paint protection film for vehicle surfaces",
        keywords: [
          "paint protection film",
          "ppf",
          "urethane film",
          "automotive",
          "clear bra",
        ],
        questions: [
          "What do you offer for automotive paint protection film?",
          "I need a PPF for vehicle paint protection",
          "Do you have a clear urethane film to protect car paint?",
          "Recommend a paint protection film product",
        ],
        answer: `The product you want is Films - Urethane Paint Protection - With Pressure-Sensitive Adhesive.

### What it is
- An elastic, transparent urethane film, 6–8 mils thick.
- Supplied with a pressure-sensitive mounting adhesive and a clear release liner.
- Intended for smooth surface applications as a removable, sacrificial surface protectant.

### What it protects against
Sand, gravel, road debris, and insects — the leading-edge damage that shows up first on hoods, bumpers, mirror caps, and rocker panels.

### Why buyers choose it
It is explicitly sacrificial and removable. The film takes the impact, and you replace the film rather than refinishing the panel. That is the whole commercial argument for PPF.

### The numbers that govern a PPF programme
- **Caliper** — published as 6–8 mils here; that thickness is what absorbs gravel energy.
- **Peel adhesion (ASTM D3330)** — must be high enough to stay down at highway speed and low enough to remove cleanly years later. This is the hardest balance in the product.
- **Elongation at break and tensile (ASTM D882)** — decides how far an installer can stretch it around a bumper radius before it necks or tears.
- **Accelerated weathering (ASTM G154 / SAE J2527)** — yellowing and gloss retention; this is what your warranty term is actually written against.

### Next step
Which panels are you covering, and are you buying bulk roll or pre-cut kits?`,
      },
      {
        stepId: "02",
        intent: "product_detail",
        scope: "product",
        fgmns: ["71100690"],
        title: "PPF thickness and application",
        keywords: [
          "thickness",
          "mils",
          "application",
          "release liner",
          "adhesive",
          "removable",
        ],
        questions: [
          "How thick is the paint protection film and how is it applied?",
          "What is the thickness of your urethane paint protection film?",
          "Tell me about the PPF adhesive and liner",
          "How does the paint protection film install?",
        ],
        answer: `Here is the detail as published for this product.

### Construction
- **Film:** elastic, transparent urethane.
- **Thickness:** 6–8 mils.
- **Adhesive:** pressure-sensitive mounting adhesive.
- **Liner:** clear release liner.

### Intended use
Appropriate smooth surface applications, as a removable and sacrificial surface protectant.

### What that means on the shop floor
Pressure-sensitive plus a clear release liner is an installer-friendly system — you can position wet, squeegee out, and see through the liner while you work. Because it is removable and sacrificial, plan replacement as part of the service offer rather than treating it as permanent.

### Honest limitation
"Smooth surface" is doing real work in that description. Heavily textured, freshly painted, or complex compound-curve surfaces need to be validated on a test panel before you commit to a vehicle.

### What to measure on your own test panel
- **Peel adhesion at 180° (ASTM D3330)** at 24 hours and at 7 days — pressure-sensitive adhesives build, so the day-one number is not the real number.
- **Removability** after accelerated heat ageing — adhesive transfer is the failure your installers will call you about.
- **Dwell before wet-out** — how long the film stays repositionable on your paint system.

### Next step
Are you applying to factory paint, or to a refinished surface?`,
      },
      {
        stepId: "03",
        intent: "document_guidance",
        scope: "product",
        fgmns: ["71100690"],
        title: "Documentation available for the PPF",
        keywords: [
          "documents",
          "sds",
          "safety data sheet",
          "ppf",
          "compliance",
        ],
        questions: [
          "What documentation is available for the paint protection film?",
          "Is there an SDS for the urethane paint protection film?",
          "Send me the documents for the PPF product",
          "Which data sheets exist for paint protection film?",
        ],
        answer: `Straight answer: for this product the safety data sheet is what is published, and I have linked it below along with the product page.

### What you get today
- **Safety data sheet** — handling, storage, and EHS review.
- **Product page** — the canonical description and the product inquiry route.

### What to request directly
Ask your Eastman representative for these by name rather than accepting a general datasheet:
- Peel adhesion to painted steel, 180°, ASTM D3330, at 24 hours and 7 days.
- Tensile strength and elongation at break, ASTM D882.
- Yellowness index change and gloss retention after accelerated weathering, ASTM G154 or SAE J2527.
- Removability and adhesive-transfer result after heat ageing.
- Written warranty term and the exposure conditions it assumes.

I would rather send you to the right person than guess at numbers that end up in a customer warranty.

### Why this matters commercially
PPF is usually sold with an installer warranty attached. Get the performance and warranty language in writing before you print marketing claims.

### Next step
Do you want the sample and inquiry route so you can request performance data and warranty terms?`,
      },
    ],
  },
  {
    flowId: "pu-hot-melt-adhesive",
    title: "Reactive polyurethane hot melt adhesive",
    persona: "Adhesive formulator developing a PUR hot melt",
    steps: [
      {
        stepId: "01",
        intent: "application_fit",
        scope: "product",
        fgmns: ["71124905"],
        title: "Polyester resin for PUR hot melt adhesives",
        keywords: [
          "polyurethane hot melt",
          "pur",
          "adhesive",
          "polyester resin",
          "eastek 4100",
          "crosslinking",
        ],
        questions: [
          "I'm formulating a reactive polyurethane hot melt adhesive",
          "Which resin do you recommend for PUR hot melt adhesives?",
          "I need a polyester resin for polyurethane hot melt",
          "What works in a reactive hot melt adhesive formulation?",
        ],
        answer: `For a polyurethane hot melt, Eastman Eastek 4100 polymer is where I would start the formulation work.

### What it brings to the formulation
- High-performance polyester resin designed specifically for polyurethane hot melt adhesive applications.
- Improves cross linking — the green-strength-to-final-strength curve most PUR formulators are fighting.
- Increases Tg, which supports heat resistance in the cured bond.
- Improves formulation flexibility, so you have more room with isocyanate ratio and tackifier loading.

### Where it is already working
Woodworking, packaging, assembly, and automotive applications — the claim is greater productivity, application consistency, long-term durability, and an expanded application space.

### The honest framing
This is a component in your formulation, not a finished adhesive. Bond performance will come from your full system.

### TDS checkpoints for a PUR hot melt
- **Hydroxyl number (mg KOH/g)** — drives your isocyanate stoichiometry. Get this wrong and nothing else matters.
- **Glass transition temperature (DSC, ASTM E1356)** — the resin raises Tg, and Tg is what holds the bond at elevated service temperature.
- **Melt viscosity (Brookfield, ASTM D3236)** at your application temperature — decides whether your slot die or bead nozzle can run it.
- **Acid number and moisture content** — both consume isocyanate and both shorten pot life in a reactive system.

### Next step
What substrates are you bonding, and are you limited by open time or by heat resistance?`,
      },
      {
        stepId: "02",
        intent: "product_comparison",
        scope: "comparison",
        fgmns: ["71124905", "71124886"],
        title: "Eastek 4100 vs Eastek 4500",
        keywords: [
          "compare",
          "eastek 4100",
          "eastek 4500",
          "viscosity",
          "uv resistance",
          "tg",
        ],
        questions: [
          "Compare Eastman Eastek 4100 and Eastek 4500",
          "What is the difference between Eastek 4100 and Eastek 4500?",
          "Eastek 4100 or 4500 for my hot melt?",
          "Eastek 4100 versus Eastek 4500 polymer",
        ],
        answer: `This is the most useful comparison in the Eastek range, because the two resins solve different formulation problems.

### Eastman Eastek 4100 polymer
- Designed to **improve cross linking**, increase Tg, and improve formulation flexibility.
- Pick it when your problem is bond development and durability.

### Eastman Eastek 4500 polymer
- Designed to **reduce viscosity**, increase Tg, enhance UV resistance, and improve formulation compatibility.
- Pick it when your problem is processing — the adhesive is too thick to apply cleanly — or when the bond line sees light.

### Shared claims
Both are high-performance polyester resins for polyurethane hot melt adhesives, and both are positioned for greater productivity, application consistency, and long-term durability.

### Put them side by side on these lines
| Property | Test method | Why it decides this job |
| --- | --- | --- |
| Melt viscosity at application temperature | Brookfield, ASTM D3236 | Whether your applicator can lay a clean bead |
| Glass transition temperature | DSC, ASTM E1356 | Heat resistance of the cured bond |
| Hydroxyl number | mg KOH/g | Isocyanate stoichiometry |
| Moisture content | Karl Fischer, ASTM D6304 | Pot life and foaming in a reactive system |

### How I would run the trial
Formulators frequently blend them: 4100 for crosslink density, 4500 to pull the application viscosity back down. Confirm the actual viscosity and Tg values in each technical data sheet — both are linked below.

### Next step
Is your current bottleneck application viscosity, or bond durability under heat and light?`,
      },
      {
        stepId: "03",
        intent: "application_fit",
        scope: "product",
        fgmns: ["71128240"],
        title: "Performance additive for solvent-borne adhesives",
        keywords: [
          "solvent borne",
          "adhesive",
          "solus 9134",
          "flexibility",
          "plasticizer reduction",
          "additive",
        ],
        questions: [
          "I also need better flexibility in a solvent-borne adhesive",
          "Which additive helps a solvent based adhesive formulation?",
          "Do you have a resin that reduces plasticizer in adhesives?",
          "Recommend a performance additive for adhesive formulations",
        ],
        answer: `Different problem, different product — this one is Eastman Solus 9134 performance additive.

### Why it comes up in adhesive work
- Designed to deliver on the high performance expectations of modern formulations across various adhesive applications.
- Soluble in a range of solvents and solvent combinations, so it drops into existing solvent-borne systems.
- Higher flexibility, which **may enable reduced plasticizer modification** compared with other resins.

### Why formulators care about that last point
Every unit of plasticizer you remove is a migration, fogging, and regulatory conversation you no longer have to win. That is usually worth more than the raw cost delta.

### Documentation note
For this product a safety data sheet is published; I have linked it below with the product page. Request formulation-specific data through the product inquiry route.

### What to ask for by name
- Solubility and compatibility data in your specific solvent blend.
- Glass transition temperature and softening point, so you can model the flexibility trade against your current plasticizer level.
- Recommended starting loading, and the plasticizer reduction that loading has delivered in comparable systems.
- Migration or extraction data if your substrate is a plasticizer-sensitive film.

### Next step
Are you trying to cut plasticizer for regulatory reasons, or to stop migration into the substrate?`,
      },
      {
        stepId: "04",
        intent: "conversion",
        scope: "product",
        fgmns: ["71124886"],
        title: "Qualifying Eastek 4500",
        keywords: [
          "qualify",
          "documents",
          "sample",
          "eastek 4500",
          "trial",
          "next steps",
        ],
        questions: [
          "Which documents do I need to qualify Eastek 4500?",
          "How do I start a trial with Eastman Eastek 4500?",
          "What is the process to sample Eastek 4500?",
          "I want to move forward with Eastek 4500",
        ],
        answer: `Here is the path I would run with a formulator at your stage.

### Documents to pull first
- **Technical data sheet** — melt viscosity (Brookfield, ASTM D3236), glass transition temperature (DSC), hydroxyl number, and recommended handling. This is what your formulation model needs.
- **Safety data sheet** — isocyanate-containing systems get real EHS scrutiny, so get this to your safety team early.

Both are linked below this answer.

### Trial sequence
1. Benchmark your current formulation so you have a baseline: application viscosity, open time, green strength at 30 seconds, and final lap shear (ASTM D1002 or D3163 depending on substrate).
2. Substitute at a single loading level and re-measure application viscosity and open time.
3. Only then adjust isocyanate ratio — changing two variables at once wastes a week.
4. Age the bonds under your real heat and light exposure, then repeat the lap shear.

### Commercial route
Sample quantities, pricing, and supply lead time come from your Eastman representative through the product inquiry form on the linked product page.

### Next step
Do you want a summary of this thread formatted for your product inquiry submission?`,
      },
    ],
  },
  {
    flowId: "waterborne-adhesive-plasticizer",
    title: "Water-based and PVAc adhesive plasticizers",
    persona: "Adhesive formulator working on PVAc and PVC systems",
    steps: [
      {
        stepId: "01",
        intent: "application_fit",
        scope: "product",
        fgmns: ["71071555"],
        title: "Plasticizer for water-based PVAc adhesives",
        keywords: [
          "plasticizer",
          "water based adhesive",
          "pvac",
          "polyvinyl acetate",
          "benzoflex 2088",
          "high solvating",
        ],
        questions: [
          "I need a plasticizer for a water-based PVAc adhesive",
          "Which plasticizer works in polyvinyl acetate adhesives?",
          "Recommend a plasticizer for water based adhesive systems",
          "What plasticizer do you have for PVAc glue?",
        ],
        answer: `Benzoflex 2088 Plasticizer is the grade written directly for what you are doing.

### Why it fits
- A high solvating plasticizer known for exceptional performance in **PVC, polyvinyl acetate, and water-based adhesive systems**.
- High solvating means efficient plasticization at lower loading — you get the flexibility you need without flooding the formulation.
- The PVAc and water-based callout is explicit, so you are not extrapolating from a neighbouring application.

### What high solvating changes in practice
Faster fusion, better film formation, and generally a more forgiving open time. It also means you should re-optimise loading rather than swapping one-for-one with a general purpose plasticizer.

### TDS checkpoints for a plasticizer swap
- **Viscosity at 25 °C (ASTM D445)** — decides whether your existing metering pumps and mixers handle it unchanged.
- **Specific gravity (ASTM D1298)** — you dose by weight but your formulation is written by volume; get this before you scale.
- **Volatility / weight loss on heating** — governs fogging, odour, and long-term embrittlement of the dried film.
- **Solvating power, typically shown as gelation or fusion temperature** — this is the property that lets you cut loading versus a general purpose plasticizer.

### Next step
Is this a wood glue, a laminating adhesive, or a pressure-sensitive system?`,
      },
      {
        stepId: "02",
        intent: "product_comparison",
        scope: "comparison",
        fgmns: ["71071555", "71071434"],
        title: "Benzoflex 2088 vs Benzoflex 9-88",
        keywords: [
          "compare",
          "benzoflex 2088",
          "benzoflex 9 88",
          "plasticizer",
          "flooring",
          "sealants",
        ],
        questions: [
          "How does Benzoflex 2088 compare to Benzoflex 9-88?",
          "Compare Benzoflex 2088 and Benzoflex 9-88",
          "Benzoflex 2088 or 9-88 for my formulation?",
          "Difference between Benzoflex 2088 and Benzoflex 9 88",
        ],
        answer: `Both are high solvating benzoate plasticizers, so the question is really about breadth versus focus.

### Benzoflex 2088 Plasticizer
- Known for exceptional performance in PVC, polyvinyl acetate, and water-based adhesive systems.
- The focused choice when your system is PVAc or water-based adhesive.

### Benzoflex 9-88 Plasticizer
- A high solvating benzoate ester plasticizer for a **wide variety of polymer systems and applications**.
- Named uses include resilient flooring, adhesives, caulks, and sealants.
- The broader choice when one plasticizer has to serve several product lines.

### Put them side by side on these lines
| Property | Test method | Why it decides this job |
| --- | --- | --- |
| Viscosity at 25 °C | ASTM D445 | Metering and mixing without equipment changes |
| Specific gravity | ASTM D1298 | Converting your formulation from volume to weight |
| Volatility / weight loss | Heat ageing | Fogging, odour, long-term embrittlement |
| Gelation or fusion temperature | Solvating power | How far you can cut loading |

### How I would decide
If you are formulating a single water-based adhesive, 2088 is the tighter fit. If your plant also runs flooring, caulk, or sealant lines, 9-88 consolidates your raw material list and your qualification burden. Compare those four rows in the two technical data sheets before you commit — both are linked below.

### Next step
Are you optimising one adhesive, or consolidating plasticizers across several product lines?`,
      },
      {
        stepId: "03",
        intent: "application_fit",
        scope: "product",
        fgmns: ["71071435"],
        title: "Plasticizer for cast urethane systems",
        keywords: [
          "cast urethane",
          "benzoflex 9 88 sg",
          "cure interference",
          "tear strength",
          "filler acceptance",
        ],
        questions: [
          "What about cast urethane systems?",
          "Which plasticizer suits cast urethane applications?",
          "Do you have a plasticizer that does not interfere with urethane cure?",
          "Recommend a plasticizer for cast polyurethane",
        ],
        answer: `For cast urethane the specific recommendation is Benzoflex 9-88 SG Plasticizer, and the "SG" distinction matters.

### Why this grade for urethanes
- Recommended for cast urethane applications that require **minimum cure interference** and maximum compatibility.
- Offers excellent inert filler acceptance.
- Contributes improved tear strength and better rebound.
- Reduces swell with certain solvents.
- Adaptable to both metering and hand batch urethane mix systems.

### The point that usually closes the conversation
Cure interference is the failure mode that ruins a urethane trial. A plasticizer that is otherwise perfect will still fail you if it poisons the cure. This grade is specified around avoiding exactly that.

### What to verify
Confirm compatibility with your specific polyol and isocyanate package in the linked technical data sheet, and run a small-batch cure check before scaling. On the cured elastomer, the properties that prove the claims above are tear strength (ASTM D624, Die C), rebound resilience (ASTM D2632), Shore A hardness (ASTM D2240), and volume swell in your service fluid (ASTM D471). Run your baseline plasticizer alongside it or the numbers tell you nothing.

### Next step
Are you running a metered system or hand batching, and what filler loading are you targeting?`,
      },
    ],
  },
  {
    flowId: "medical-device-molding",
    title: "Medical device moulding",
    persona: "Medical device engineer selecting a biocompatible clear polymer",
    steps: [
      {
        stepId: "01",
        intent: "application_fit",
        scope: "product",
        fgmns: ["71070154"],
        title: "Biocompatible clear polymer for medical devices",
        keywords: [
          "medical device",
          "biocompatible",
          "iso 10993",
          "usp class vi",
          "tritan mx711",
          "clear",
        ],
        questions: [
          "I need a clear biocompatible polymer for a medical device housing",
          "Which Eastman material meets ISO 10993 for medical devices?",
          "Recommend a medical grade clear polymer",
          "What do you have for USP Class VI medical parts?",
        ],
        answer: `Eastman Tritan MX711 copolyester is the grade I would put forward for a medical housing.

### Why it fits
- Meets ISO 10993 and/or USP Class VI biocompatibility requirements — the gate your regulatory team checks first.
- Formulated specifically for medical devices, not adapted from an industrial grade.
- Excellent toughness, so the part survives handling, drops, and snap-fit assembly.
- Hydrolytic stability and heat resistance, which is what lets it face steam and repeated cleaning cycles.
- Chemical resistance against the disinfectants and lipids that crack lesser clear polymers.

### The one thing to confirm early
Your specific sterilisation route — steam, gamma, EtO — drives grade selection more than any other requirement.

### TDS and regulatory checkpoints
- **Biocompatibility** — ISO 10993 and/or USP Class VI, as stated for this grade. Get the supporting documentation, not just the claim.
- **Heat deflection temperature (ASTM D648)** — read at 0.45 MPa against your autoclave temperature, with margin.
- **Notched Izod impact (ASTM D256)** — and ask specifically for the value after sterilisation, because gamma exposure can shift it.
- **Haze and luminous transmittance (ASTM D1003)** — plus yellowness index (ASTM E313) after gamma, which is where clear medical parts usually disappoint.
- **Chemical resistance data** — against your actual disinfectant list, under stress. Unstressed coupon data will flatter any polymer.

### Next step
Which sterilisation method will this device see, and is the part thick-walled or thin-walled?`,
      },
      {
        stepId: "02",
        intent: "product_comparison",
        scope: "comparison",
        fgmns: ["71070154", "71070516"],
        title: "Tritan MX711 vs Tritan MX730",
        keywords: [
          "compare",
          "mx711",
          "mx730",
          "high flow",
          "thin wall",
          "viscosity",
        ],
        questions: [
          "Compare Tritan MX711 and MX730 for thin-wall molding",
          "What is the difference between Tritan MX711 and Tritan MX730?",
          "MX711 or MX730 for my medical part?",
          "Tritan MX711 versus Tritan MX730",
        ],
        answer: `Both are medical grades that meet ISO 10993 and/or USP Class VI biocompatibility requirements, so the decision is a flow decision.

### Eastman Tritan MX711 copolyester
- Excellent toughness, hydrolytic stability, heat resistance, and chemical resistance.
- Formulated for medical devices.
- The default when the part has normal wall sections and you want maximum toughness.

### Eastman Tritan MX730 copolyester
- A **high flow** medical grade with viscosity reductions of **40–50% relative to Tritan MX710 copolyester**.
- Same feature set — toughness, hydrolytic stability, heat resistance, chemical resistance — plus melt flowability.
- The default when you are filling long, thin, or multi-cavity geometry.

### Put them side by side on these lines
| Property | Test method | Why it decides this job |
| --- | --- | --- |
| Melt flow rate / melt viscosity | ASTM D1238 | Filling thin walls and balancing cavities |
| Notched Izod impact | ASTM D256 | Toughness margin you give up for flow |
| Heat deflection temperature | ASTM D648 | Autoclave and service temperature |
| Mould shrinkage | ASTM D955 | Cavity sizing across a multi-cavity tool |
| Biocompatibility | ISO 10993 / USP Class VI | Regulatory gate for both grades |

### How I would decide
If your moulder is fighting short shots, high injection pressure, or cavity imbalance, MX730 is the answer — the published 40–50% viscosity reduction against MX710 is a large processing lever. If the part fills comfortably, stay with MX711 and keep the toughness margin. Confirm the actual values in both technical data sheets, linked below.

### Next step
What is your thinnest wall section, and how many cavities are you running?`,
      },
      {
        stepId: "03",
        intent: "application_fit",
        scope: "product",
        fgmns: ["71072160"],
        title: "Medical grade with vegetable-based mould release",
        keywords: [
          "mold release",
          "vegetable based",
          "mx811",
          "demoulding",
          "residual stress",
          "clarity",
        ],
        questions: [
          "Do you have a grade with a vegetable-based mold release?",
          "Which Tritan medical grade includes a mould release?",
          "I need easier ejection on a clear medical part",
          "Is there a medical grade Tritan with internal release agent?",
        ],
        answer: `Yes — Eastman Tritan MX811 copolyester is the grade you are describing.

### What makes it different
- Contains a **mould release derived from vegetable-based sources**, which is an easier conversation with sustainability and regulatory reviewers than a conventional release package.
- Meets ISO 10993 and/or USP Class VI biocompatibility requirements.
- Excellent appearance and clarity, with excellent toughness, hydrolytic stability, and heat and chemical resistance.
- Can be moulded into various applications **without incorporating high levels of residual stress**.

### Why the residual stress point matters to you
On clear medical parts, residual stress is what turns a passing part into a crazed part after its first disinfectant exposure. A grade that moulds low-stress buys you margin you cannot buy back later.

### How to prove it on your own parts
- **Polarised light inspection** of moulded parts — fringe density is your visual stress map, and it is free.
- **Stressed chemical resistance** — strain jig or bent-strip exposure to your disinfectant list, not unstressed coupons.
- **Haze and yellowness index (ASTM D1003 and ASTM E313)** before and after sterilisation.
- **Mould release confirmation** — ask whether the vegetable-based release affects secondary operations such as bonding, printing, or ultrasonic welding. It sometimes does.

### Next step
Are you seeing ejection marks, or stress crazing after chemical exposure?`,
      },
    ],
  },
  {
    flowId: "recyclable-cosmetics-packaging",
    title: "Recyclable cosmetics packaging",
    persona: "Beauty brand packaging developer with a recyclability mandate",
    steps: [
      {
        stepId: "01",
        intent: "application_fit",
        scope: "product",
        fgmns: ["71118275"],
        title: "PET-recycling-compatible cosmetics resin",
        keywords: [
          "recyclable",
          "cosmetics packaging",
          "pet recycling stream",
          "cristal en067",
          "clarity",
        ],
        questions: [
          "I need recyclable cosmetics packaging resin compatible with PET recycling",
          "Which resin is compatible with the PET recycling stream for cosmetics?",
          "Recommend a recyclable material for beauty packaging",
          "What do you have for recyclable cosmetic jars and caps?",
        ],
        answer: `Eastman Cristal EN067 copolyester is built for exactly this mandate.

### Why it fits
- Designed to be **fully compatible with the PET recycling stream**, which is the claim your retailer and regulator actually test.
- Enables recyclable cosmetics packaging with a combination of good colour and high clarity for moulded parts.
- Aimed squarely at the cosmetics and personal care market, so the aesthetic bar is already built in.

### Why brands care about stream compatibility
A beautiful pack that contaminates the PET stream fails its recyclability claim and, increasingly, its shelf listing. Stream compatibility protects both the claim and the listing.

### What to confirm
Wall thickness and decoration method — coatings, metallisation, and certain inks can undo stream compatibility no matter what the resin does.

### TDS checkpoints for a cosmetics pack
- **Haze and luminous transmittance (ASTM D1003)** — measured on a thick section, not a 3 mm plaque, because thick-wall cosmetics parts amplify haze.
- **Notched Izod impact (ASTM D256)** — the drop test your retailer will run on a filled pack.
- **Specific gravity (ASTM D792)** — drives part weight and therefore both perceived quality and material cost.
- **Mould shrinkage (ASTM D955)** — thick-wall parts shrink over long cycles; this is where sink marks come from.
- **Chemical resistance** — against your actual formulation, especially essential oils, alcohols, and fragrance, under stress.

### Next step
Is this an injection moulded jar and cap, or an extrusion blow moulded bottle?`,
      },
      {
        stepId: "02",
        intent: "sustainability_fit",
        scope: "product",
        fgmns: ["71119550"],
        title: "Certified recycled content option",
        keywords: [
          "certified recycled content",
          "cristal one renew 100",
          "sustainability claim",
          "thick wall",
          "cosmetics",
        ],
        questions: [
          "Can I get certified recycled content in that family?",
          "Which Cristal grade has the highest recycled content?",
          "Do you have a 100% recycled content cosmetics resin?",
          "I need a recycled content claim for my packaging",
        ],
        answer: `Eastman Cristal One Renew 100 is the high end of that ladder.

### What it offers
- Designed to be fully compatible with the PET recycling stream.
- Enables recyclable cosmetics packaging that is tough and exhibits good chemical resistance.
- Contains **100% certified recycled content**, which is the strongest claim in this family.
- Suitable for moulding thick-walled parts, so you keep the premium weight and glasslike feel that beauty packaging sells on.

### The ladder behind it
The Renew family is graded — Renew 25, 30, 50, and 100 — so you can match the recycled content claim to the price point of each SKU rather than forcing one answer across your whole range.

### Substantiating the claim
Certification scheme, mass-balance methodology, and market-specific labelling need formal documentation. Start with the linked product page and technical data sheet, then confirm the certificate through your Eastman representative.

### The technical check most brands skip
Recycled content grades are not automatically drop-in. Compare the Renew 100 technical data sheet against the virgin grade on colour (L*a*b* or yellowness index, ASTM E313), haze (ASTM D1003), notched Izod impact (ASTM D256), and mould shrinkage (ASTM D955). Colour and haze are where a recycled stream shows up first, and on a premium pack those are the two properties your brand team will reject on.

### Next step
Do you need one claim across the range, or different recycled content by SKU tier?`,
      },
      {
        stepId: "03",
        intent: "application_fit",
        scope: "product",
        fgmns: ["71124222"],
        title: "Recycled content for blow moulded bottles",
        keywords: [
          "extrusion blow molding",
          "bottles",
          "cristal one e renew 25",
          "skincare",
          "personal care",
        ],
        questions: [
          "What about extrusion blow molded bottles with recycled content?",
          "Which grade works for blow moulded skincare bottles?",
          "I need a recycled content resin for EBM bottles",
          "Recommend a bottle grade for personal care with recycled content",
        ],
        answer: `For extrusion blow moulding, move across to Eastman Cristal One E Renew 25.

### Why the "E" grade
- Designed to be fully compatible with the PET recycling stream.
- Specified for **extrusion-blown moulded bottles** for the skincare, personal care, and colour cosmetics markets.
- The Renew 25 designation carries the recycled content claim at an entry tier.

### Why you cannot reuse the injection grade
Extrusion blow moulding needs melt strength that injection grades are not designed to deliver. Parison sag and wall distribution will tell you within one shift. Matching the process family first saves a wasted trial.

### Scaling the claim
The same E family runs Renew 25, 30, 50, and 100, so you can raise the recycled content claim later without changing process family or re-qualifying the bottle geometry.

### What to check in the TDS before an EBM trial
- **Intrinsic viscosity or melt strength indication** — the property that keeps a parison from sagging. This is the single most important line for blow moulding.
- **Mould shrinkage (ASTM D955)** — bottle neck finish tolerance is unforgiving.
- **Haze (ASTM D1003)** on your actual wall thickness.
- **Drying conditions** — under-dried copolyester degrades in the extruder and you will see it as streaks down the bottle.
- **Top-load and drop performance** — run these on filled bottles, because that is how the pack ships.

### Next step
What bottle size and wall distribution are you targeting, and do you have an existing EBM line?`,
      },
    ],
  },
  {
    flowId: "commercial-handoff",
    title: "Samples, pricing, and representative handoff",
    persona: "Any buyer ready to convert",
    steps: [
      {
        stepId: "01",
        intent: "conversion",
        scope: "general",
        fgmns: [],
        title: "How to request samples and pricing",
        keywords: [
          "sample",
          "pricing",
          "quote",
          "lead time",
          "minimum order",
          "request",
        ],
        questions: [
          "How do I request samples and pricing?",
          "What is the process to get a sample?",
          "Can I get a quote?",
          "How do I order material for a trial?",
        ],
        answer: `Here is how a request turns into material on your dock.

### The route
1. **Open the product page** for the grade we discussed — the link sits under each recommendation in this conversation.
2. **Use the product inquiry form** on that page. It routes to the commercial team covering your region and industry.
3. **Include the qualifying detail:** process, part geometry, annual volume, target launch date, and any regulatory or sustainability claim you must support.
4. **Expect a representative to respond** with sample availability, pricing, lead time, and minimum order quantity.

### What I cannot tell you
Price, stock, lead time, and minimum order quantity are commercial terms. They are not in this product catalog, and I will not guess at them.

### What speeds it up
Naming the grade and the volume in your first message typically removes a full round of back-and-forth.

### Next step
Would you like a summary of this conversation to paste into the inquiry form?`,
      },
      {
        stepId: "02",
        intent: "conversion",
        scope: "general",
        fgmns: [],
        title: "Connecting with an Eastman representative",
        keywords: [
          "representative",
          "contact",
          "sales team",
          "talk to someone",
          "handoff",
        ],
        questions: [
          "Can you connect me with an Eastman representative?",
          "I want to talk to a person about this",
          "Who do I contact to take this further?",
          "Put me in touch with sales",
        ],
        answer: `Yes — and this is the right moment to do it, because the questions ahead of you are commercial and application-specific.

### What to send them
- **The grade or grades** we shortlisted in this conversation.
- **Your application** and the two or three requirements that actually decide the material.
- **Volume and timing**, even if approximate.
- **Any claim you must substantiate** — biocompatibility, recycled content, BPA-free, recyclability.

### Where to send it
Use the product inquiry link on any product page from this conversation. If you are still comparing grades, the general product inquiry route works just as well and the representative will narrow it with you.

### What to expect
A technical contact for data and trials, and a commercial contact for terms. On a defined application, most programmes move from inquiry to sample quickly.

### Next step
Which grade should I summarise for your handoff?`,
      },
    ],
  },
];

module.exports = { flows };
