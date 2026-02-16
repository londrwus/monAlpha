import { NextRequest, NextResponse } from "next/server";
import { getModel, isBuiltIn } from "@/lib/analysis/registry";
import { getCustomModel, updateCustomModel, deleteCustomModel } from "@/lib/skills/model-store";
import { parseAndValidateSkill } from "@/lib/skills/parser";
import { analysisStore } from "@/lib/analysis/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const model = getModel(id);

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const analyses = analysisStore.getByModel(id);
  const avgScore = analyses.length > 0
    ? analyses.reduce((s, a) => s + a.score, 0) / analyses.length
    : 0;

  const custom = getCustomModel(id);

  return NextResponse.json({
    id: model.id,
    name: model.name,
    description: model.description,
    version: model.version,
    creator: model.creator,
    isBuiltIn: isBuiltIn(id),
    breakdownLabels: model.breakdownLabels,
    price: custom?.price || 0,
    createdAt: custom?.createdAt || 0,
    skillMarkdown: custom?.skillMarkdown || null,
    usageCount: analyses.length,
    avgScore: Math.round(avgScore * 10) / 10,
    recentAnalyses: analyses.slice(0, 10),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isBuiltIn(id)) {
    return NextResponse.json({ error: "Cannot modify built-in models" }, { status: 403 });
  }

  const custom = getCustomModel(id);
  if (!custom) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { creator, skillMarkdown, price } = body as {
      creator: string;
      skillMarkdown?: string;
      price?: number;
    };

    if (creator.toLowerCase() !== custom.creator.toLowerCase()) {
      return NextResponse.json({ error: "Only the creator can modify this model" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (price !== undefined) updates.price = price;

    if (skillMarkdown) {
      const result = parseAndValidateSkill(skillMarkdown);
      if (!result.valid || !result.parsed) {
        return NextResponse.json(
          { error: "Invalid SKILL.md", errors: result.errors },
          { status: 400 }
        );
      }
      updates.skillMarkdown = skillMarkdown;
      updates.parsedSkill = result.parsed;
      updates.name = result.parsed.name;
      updates.description = result.parsed.aiSystemPrompt.slice(0, 200);
    }

    const updated = updateCustomModel(id, updates as Parameters<typeof updateCustomModel>[1]);
    return NextResponse.json({ model: updated });
  } catch (err) {
    return NextResponse.json({ error: "Update failed", message: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isBuiltIn(id)) {
    return NextResponse.json({ error: "Cannot delete built-in models" }, { status: 403 });
  }

  const custom = getCustomModel(id);
  if (!custom) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const creator = searchParams.get("creator") || "";
  if (creator.toLowerCase() !== custom.creator.toLowerCase()) {
    return NextResponse.json({ error: "Only the creator can delete this model" }, { status: 403 });
  }

  deleteCustomModel(id);
  return NextResponse.json({ deleted: true });
}
