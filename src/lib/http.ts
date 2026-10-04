import { NextResponse } from "next/server";

/** An error response from an API route: `{ error }` with the given status. */
export const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status });
