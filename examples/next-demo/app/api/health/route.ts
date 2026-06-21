export const dynamic = "force-dynamic";

// Lets the client show whether the server already has a Meshy key (env),
// so the status indicator isn't misleadingly "mock" when env provides one.
export async function GET() {
  return Response.json({ hasServerKey: Boolean(process.env.MESHY_API_KEY) });
}
