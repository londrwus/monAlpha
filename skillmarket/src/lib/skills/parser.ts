export interface ScoringCategory {
  label: string;
  weight: number; // raw points from SKILL.md
}

export interface ParsedSkill {
  name: string;
  type: string;
  dataSources: string[];
  analysisSteps: string[];
  scoringBreakdown: ScoringCategory[];
  signalLogic: { buyThreshold: number; avoidThreshold: number };
  aiSystemPrompt: string;
}

export interface ParseResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed: ParsedSkill | null;
}

function extractSection(markdown: string, heading: string): string | null {
  // Match ## Heading and capture everything until next ## or end
  const regex = new RegExp(
    `^##\\s+${escapeRegex(heading)}\\s*\\n([\\s\\S]*?)(?=^##\\s|$(?!\\n))`,
    "mi"
  );
  const match = markdown.match(regex);
  return match ? match[1].trim() : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractName(markdown: string): string {
  // First line starting with # (but not ##)
  const match = markdown.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : "Unnamed Model";
}

function parseListItems(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*\d.]+\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function parseScoringBreakdown(text: string): ScoringCategory[] {
  const categories: ScoringCategory[] = [];
  const lines = text.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    // Match patterns like "Holder Distribution: 40 points" or "Holder Distribution: 40"
    const match = line.match(/^[-*]?\s*(.+?):\s*(\d+)\s*(?:points?|pts?)?/i);
    if (match) {
      categories.push({
        label: match[1].trim(),
        weight: parseInt(match[2], 10),
      });
    }
  }

  return categories;
}

function parseSignalLogic(text: string): { buyThreshold: number; avoidThreshold: number } {
  let buyThreshold = 75;
  let avoidThreshold = 50;

  const buyMatch = text.match(/BUY[:\s]*(?:Total\s+)?(?:score\s*)?[>>=]\s*(\d+)/i);
  const avoidMatch = text.match(/AVOID[:\s]*(?:Total\s+)?(?:score\s*)?[<<=]\s*(\d+)/i);

  if (buyMatch) buyThreshold = parseInt(buyMatch[1], 10);
  if (avoidMatch) avoidThreshold = parseInt(avoidMatch[1], 10);

  return { buyThreshold, avoidThreshold };
}

function extractQuotedPrompt(text: string): string {
  // Try to extract content between quotes first
  const quoted = text.match(/"([\s\S]+?)"/);
  if (quoted) return quoted[1].trim();
  // Otherwise use the whole section
  return text.trim();
}

export function parseAndValidateSkill(markdown: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!markdown || markdown.trim().length < 50) {
    return { valid: false, errors: ["Content too short"], warnings: [], parsed: null };
  }

  const name = extractName(markdown);

  // Required sections
  const typeSection = extractSection(markdown, "Type");
  const signalSection = extractSection(markdown, "Signal Logic");
  const promptSection = extractSection(markdown, "AI System Prompt");
  const scoringSection = extractSection(markdown, "Scoring Breakdown");

  const modelType = typeSection?.trim().toUpperCase() || "";
  const isDeepResearch = modelType === "DEEP_RESEARCH";

  if (!typeSection) errors.push("Missing ## Type section");
  else if (modelType !== "RESEARCH" && modelType !== "DEEP_RESEARCH") {
    errors.push("Type must be RESEARCH or DEEP_RESEARCH");
  }
  if (!signalSection) errors.push("Missing ## Signal Logic section");
  if (!promptSection) {
    errors.push("Missing ## AI System Prompt section");
  } else if (isDeepResearch && promptSection.trim().length < 20) {
    errors.push("DEEP_RESEARCH models require a detailed AI System Prompt (min 20 chars)");
  }
  if (!scoringSection && !isDeepResearch) errors.push("Missing ## Scoring Breakdown section");

  // Optional sections
  const dataSourcesSection = extractSection(markdown, "Data Sources");
  const stepsSection = extractSection(markdown, "Analysis Steps");

  if (!dataSourcesSection) warnings.push("No data sources specified");
  if (!stepsSection) warnings.push("No analysis steps specified");

  // Parse scoring breakdown (optional for DEEP_RESEARCH)
  const scoringBreakdown = scoringSection ? parseScoringBreakdown(scoringSection) : [];
  if (scoringSection && scoringBreakdown.length === 0 && !isDeepResearch) {
    errors.push("Scoring Breakdown section has no valid categories (use format: 'Label: N points')");
  }

  // Validate scoring weights sum
  if (scoringBreakdown.length > 0) {
    const totalWeight = scoringBreakdown.reduce((s, c) => s + c.weight, 0);
    if (totalWeight !== 100) {
      warnings.push(`Scoring weights sum to ${totalWeight}, not 100 — will be normalized`);
    }
  }

  // Parse signal logic
  const signalLogic = signalSection
    ? parseSignalLogic(signalSection)
    : { buyThreshold: 75, avoidThreshold: 50 };

  if (signalLogic.buyThreshold <= signalLogic.avoidThreshold) {
    errors.push("BUY threshold must be greater than AVOID threshold");
  }

  const parsed: ParsedSkill = {
    name,
    type: typeSection?.trim() || "RESEARCH",
    dataSources: dataSourcesSection ? parseListItems(dataSourcesSection) : [],
    analysisSteps: stepsSection ? parseListItems(stepsSection) : [],
    scoringBreakdown,
    signalLogic,
    aiSystemPrompt: promptSection ? extractQuotedPrompt(promptSection) : "",
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsed: errors.length === 0 ? parsed : null,
  };
}
