import { loadStatus } from '../lib/data';
export async function GET() {
  return Response.json(await loadStatus());
}
