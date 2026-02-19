import { NextResponse } from "next/server";
import { addCampaignRegistration } from "@/actions/mongo.action";
import { isAddress } from "viem";

/** Validate a social handle: must be non-empty and reasonably short */
function isValidHandle(handle: string): boolean {
  return typeof handle === "string" && handle.trim().length > 0 && handle.length <= 64;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { xUsername, telegram, walletAddress } = body as {
      xUsername?: unknown;
      telegram?: unknown;
      walletAddress?: unknown;
    };

    // Input validation
    if (
      typeof xUsername !== "string" ||
      typeof telegram !== "string" ||
      typeof walletAddress !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!isValidHandle(xUsername)) {
      return NextResponse.json(
        { error: "Invalid X username" },
        { status: 400 }
      );
    }

    if (!isValidHandle(telegram)) {
      return NextResponse.json(
        { error: "Invalid Telegram handle" },
        { status: 400 }
      );
    }

    if (!isAddress(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    const result = await addCampaignRegistration({
      xUsername: xUsername.trim(),
      telegram: telegram.trim(),
      walletAddress: walletAddress.toLowerCase(),
      created_at: new Date(),
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to save registration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("[campaign/register] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
