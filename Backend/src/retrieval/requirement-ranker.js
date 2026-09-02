const MATERIAL_PATTERN =
  /\b(?:polymers?|plastics?|resins?|copolyesters?|polyesters?|thermoplastics?|bioplastics?|elastomers?)\b/i;
const NON_MATERIAL_ROLE_PATTERN =
  /\b(?:additives?|adhesion promoters?|plasticizers?|solvents?|dispersions?)\b/i;
const FAMILY_IGNORED_TERMS = new Set([
  "eastman",
  "polymer",
  "copolyester",
  "resin",
  "natural",
  "renew",
  "tm",
  "mr",
]);

const REQUIREMENT_DEFINITIONS = [
  {
    id: "container",
    label: "bottle or container application",
    kind: "application",
    weight: 6,
    queryPattern: /\b(?:bottles?|containers?|jars?)\b/i,
    productPattern:
      /\b(?:bottles?|containers?|jars?|extrusion[- ]blow(?:n|ing)?|injection(?: stretch)?[- ]blow(?:n|ing)?|isbm)\b/i,
    productStrength(product) {
      const text = `${product.displayName || ""} ${product.sortName || ""} ${product.description || ""}`;
      if (/\bbottles?\b/i.test(text)) return 1;
      if (/\bisbm\b/i.test(text)) return 0.95;
      if (/\b(?:containers?|jars?)\b/i.test(text)) return 0.9;
      if (
        /\b(?:extrusion[- ]blow(?:n|ing)?|injection(?: stretch)?[- ]blow(?:n|ing)?)\b/i.test(
          text,
        )
      ) {
        return 0.75;
      }
      return 0;
    },
  },
  {
    id: "adhesive-application",
    label: "adhesive or bonding application",
    kind: "application",
    weight: 6,
    queryPattern:
      /\b(?:adhesives?|glues?|bonding|hot[- ]?melts?|pressure[- ]sensitive adhesives?|sealants?|tackifiers?)\b/i,
    productPattern:
      /\b(?:adhesives?|glues?|bonding|hot[- ]?melts?|pressure[- ]sensitive adhesives?|sealants?|tackifiers?)\b/i,
    productStrength(product) {
      const identity = `${product.displayName || ""} ${product.sortName || ""}`;
      const description = product.description || "";
      if (
        /\b(?:adhesives?|glues?|sealants?|tackifiers?)\b/i.test(identity) &&
        !/\bfilms?\b/i.test(identity)
      ) {
        return 1;
      }
      if (
        /\b(?:adhesive|bonding) (?:applications?|formulations?|systems?)\b/i.test(
          description,
        ) ||
        /\b(?:for use in|used in|uses? include|formulat(?:ed|ing|ion)|designed(?: especially)? for).{0,80}\b(?:adhesives?|bonding|hot[- ]?melts?|sealants?)\b/i.test(
          description,
        )
      ) {
        return 0.85;
      }
      return 0;
    },
  },
  {
    id: "transparent",
    label: "transparency or optical clarity",
    kind: "property",
    weight: 3,
    queryPattern:
      /\b(?:transparent|transparency|clear|clarity|water[- ]clear|glass[- ]?like)\b/i,
    productPattern:
      /\b(?:transparent|transparency|clarity|water[- ]clear|glass[- ]?like|sparkling clear|optical(?:ly)? clear|low haze)\b/i,
  },
  {
    id: "bpa-free",
    label: "BPA-free claim",
    kind: "compliance",
    weight: 4,
    queryPattern:
      /\b(?:bpa\s*[- ]?\s*free|free.{0,30}\bbpa|without.{0,20}\bbpa|no\s+bpa)\b/i,
    productPattern:
      /\b(?:bpa\s*[- ]?\s*free|free.{0,80}\bbpa|without.{0,40}\bbpa|no\s+bpa)\b/i,
  },
  {
    id: "polymer-material",
    label: "polymer material",
    kind: "material",
    weight: 2,
    queryPattern: MATERIAL_PATTERN,
    productMatches(product) {
      const identity = `${product.displayName || ""} ${product.sortName || ""}`;
      if (MATERIAL_PATTERN.test(identity)) return true;
      if (NON_MATERIAL_ROLE_PATTERN.test(identity)) return false;
      return MATERIAL_PATTERN.test((product.description || "").slice(0, 240));
    },
  },
];

function productRequirementStrength(product, requirement) {
  if (requirement.productStrength) {
    return requirement.productStrength(product);
  }
  if (requirement.productMatches) {
    return requirement.productMatches(product) ? 1 : 0;
  }

  const text = `${product.displayName || ""} ${product.sortName || ""} ${product.description || ""}`;
  return requirement.productPattern.test(text) ? 1 : 0;
}

function analyzeRequirements(query) {
  return REQUIREMENT_DEFINITIONS.filter((requirement) =>
    requirement.queryPattern.test(query),
  );
}

function publicRequirements(requirements) {
  return requirements.map(({ id, kind, label }) => ({ id, kind, label }));
}

function productFamilyTerms(product) {
  return new Set(
    product.displayName
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(
        (term) =>
          term &&
          !FAMILY_IGNORED_TERMS.has(term) &&
          !/^\d+(?:\.\d+)?$/.test(term),
      ),
  );
}

function belongsToSameFamily(left, right) {
  const leftTerms = productFamilyTerms(left);
  const rightTerms = productFamilyTerms(right);
  const commonTerms = [...leftTerms].filter((term) =>
    rightTerms.has(term),
  ).length;
  const unionSize = new Set([...leftTerms, ...rightTerms]).size;
  return commonTerms >= 2 && commonTerms / unionSize >= 0.5;
}

function diversifyProductFamilies(candidates) {
  const diverse = [];
  const deferred = [];
  for (const candidate of candidates) {
    if (
      diverse.some((selected) =>
        belongsToSameFamily(selected.product, candidate.product),
      )
    ) {
      deferred.push(candidate);
    } else {
      diverse.push(candidate);
    }
  }
  return [...diverse, ...deferred];
}

function rankProductsByRequirements(query, products, lexicalResults) {
  const requirements = analyzeRequirements(query);
  if (requirements.length === 0) {
    return {
      requirements: [],
      results: lexicalResults,
      eligibleFgmns: null,
    };
  }

  const lexicalByFgmn = new Map(
    lexicalResults.map((result) => [result.fgmn, result]),
  );
  const applicationRequirements = requirements.filter(
    (requirement) => requirement.kind === "application",
  );
  let candidates = products
    .map((product) => {
      const lexical = lexicalByFgmn.get(product.fgmn);
      const requirementMatches = requirements
        .map((requirement) => ({
          requirement,
          strength: productRequirementStrength(product, requirement),
        }))
        .filter((match) => match.strength > 0);
      const applicationMatchCount = requirementMatches.filter(
        (match) => match.requirement.kind === "application",
      ).length;

      return {
        fgmn: product.fgmn,
        product,
        score: lexical?.score || 0,
        originalRank: lexical?.rank || Number.MAX_SAFE_INTEGER,
        requirementMatches,
        requirementScore: requirementMatches.reduce(
          (score, match) => score + match.requirement.weight * match.strength,
          0,
        ),
        applicationMatchCount,
      };
    })
    .filter(
      (candidate) =>
        candidate.requirementMatches.length > 0 ||
        lexicalByFgmn.has(candidate.fgmn),
    );

  let eligibleFgmns = null;
  if (applicationRequirements.length > 0) {
    const applicationMatches = candidates.filter(
      (candidate) =>
        candidate.applicationMatchCount === applicationRequirements.length,
    );
    if (applicationMatches.length > 0) {
      candidates = applicationMatches;
      eligibleFgmns = new Set(
        applicationMatches.map((candidate) => candidate.fgmn),
      );
    }
  }

  candidates.sort(
    (left, right) =>
      right.requirementScore - left.requirementScore ||
      right.requirementMatches.length - left.requirementMatches.length ||
      right.score - left.score ||
      left.originalRank - right.originalRank ||
      left.product.displayName.localeCompare(right.product.displayName),
  );
  if (applicationRequirements.length > 0) {
    candidates = diversifyProductFamilies(candidates);
  }

  return {
    requirements: publicRequirements(requirements),
    eligibleFgmns,
    results: candidates.map((candidate, index) => ({
      fgmn: candidate.fgmn,
      product: candidate.product,
      score: candidate.score,
      rank: index + 1,
      requirementScore: candidate.requirementScore,
      matchedRequirements: candidate.requirementMatches.map(
        (match) => match.requirement.id,
      ),
    })),
  };
}

module.exports = {
  analyzeRequirements,
  rankProductsByRequirements,
};
