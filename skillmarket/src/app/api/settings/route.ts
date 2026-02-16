import { NextRequest, NextResponse } from "next/server";
import { JsonStore } from "@/lib/storage/json-store";
import { analysisStore } from "@/lib/analysis/store";

interface UserSettings {
  theme: string;
  notifications: boolean;
  defaultModel: string;
}

interface SettingsStoreData {
  users: Record<string, UserSettings>;
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: "dark",
  notifications: true,
  defaultModel: "rug-detector",
};

const store = new JsonStore<SettingsStoreData>("settings.json", { users: {} });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet parameter" }, { status: 400 });
  }

  const data = store.get();
  const settings = data.users[wallet.toLowerCase()] || DEFAULT_SETTINGS;

  return NextResponse.json({
    wallet,
    settings,
    network: process.env.NETWORK || "mainnet",
    hasApiKey: !!process.env.NAD_API_KEY,
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet, settings } = body as { wallet: string; settings: Partial<UserSettings> };

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
    }

    const key = wallet.toLowerCase();
    store.update((data) => {
      const current = data.users[key] || { ...DEFAULT_SETTINGS };
      data.users[key] = { ...current, ...settings };
      return data;
    });

    return NextResponse.json({ success: true, settings: store.get().users[key] });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update settings", message: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "clear-cache") {
    analysisStore.clearAll();
    return NextResponse.json({ success: true, message: "Analysis cache cleared" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
