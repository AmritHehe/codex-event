import { connections } from "@/server/distribution/adapters";
import { authenticate, failure, reply } from "@/server/distribution/http";
export async function GET(request: Request) {
  try { authenticate(request); return reply({ channels: connections() }); }
  catch (error) { return failure(error); }
}
