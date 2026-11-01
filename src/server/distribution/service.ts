import { publishReceipt, publishRequest, type PublishInput, type PublishReceipt } from "@/lib/distribution-contracts";
import { publish, requireConnection } from "./adapters";
import { authenticate, DistributionError, failure, readBody, reply } from "./http";
import { PublicationLedger } from "./ledger";

export function createPublishHandler(deps: { publish: (input: PublishInput, signal: AbortSignal) => Promise<PublishReceipt>; ledger: PublicationLedger; requireConnection: typeof requireConnection } = { publish, ledger: new PublicationLedger(), requireConnection }) {
  return async (request: Request) => {
    try {
      authenticate(request);
      const parsed = publishRequest.safeParse(await readBody(request));
      if (!parsed.success) throw new DistributionError(400, parsed.error.issues[0]?.message ?? "Invalid publication request.");
      const input = parsed.data;
      const recovered = await deps.ledger.recover(input);
      if (recovered) return reply(recovered);
      if (input.scheduleAt && Date.parse(input.scheduleAt) < Date.now() + 60_000) throw new DistributionError(400, "Choose a schedule at least one minute in the future.");
      deps.requireConnection(input.channel);
      const existing = await deps.ledger.reserve(input);
      if (existing) return reply(existing);
      try {
        // Do not cancel a publication on client disconnect: it may already be on the channel.
        const receipt = publishReceipt.parse(await deps.publish(input, AbortSignal.timeout(30_000)));
        await deps.ledger.finish(input, receipt);
        return reply(receipt);
      } catch {
        await deps.ledger.finish(input).catch(() => {});
        throw new DistributionError(502, "Publication could not be confirmed. Check the destination account or aggregator dashboard before trying a new request.");
      }
    } catch (error) { return failure(error); }
  };
}
