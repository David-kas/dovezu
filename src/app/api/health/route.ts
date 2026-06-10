import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "dovezu",
    url: "https://dovezu.vercel.app",
    timestamp: new Date().toISOString(),
  });
}
