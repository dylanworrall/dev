import { NextResponse } from "next/server";

const noopHandler = () => NextResponse.json({ session: null }, { status: 200 });

export const GET = noopHandler;
export const POST = noopHandler;
