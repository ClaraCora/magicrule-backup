import { loadCatalog } from '../lib/data';
import { searchIndex } from '../lib/search';
export async function GET() {
  return Response.json(searchIndex(await loadCatalog()));
}
