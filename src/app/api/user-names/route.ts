import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const NAMES_FILE_PATH = join(process.cwd(), "src/app/api/user-names.json");

export async function GET() {
  try {
    if (!existsSync(NAMES_FILE_PATH)) {
      return NextResponse.json({});
    }

    const content = readFileSync(NAMES_FILE_PATH, "utf-8");
    const data = JSON.parse(content);
    return NextResponse.json(
      typeof data === "object" && data !== null ? data : {}
    );
  } catch (error) {
    console.error("Error reading user-names.json:", error);
    return NextResponse.json({});
  }
}
