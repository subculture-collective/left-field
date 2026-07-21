import { CorrectionForm } from "@/components/correction-form";
import { Shell } from "@/components/presentational";
import { correctionReleaseIdSchema, correctionSeatCycleIdSchema } from "@/domain/corrections";

type Props = { searchParams: Promise<{ release?: string | string[]; seat?: string | string[] }> };

const one = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

export default async function CorrectionsPage({ searchParams }: Props) {
  const query = await searchParams;
  const release = one(query.release);
  const seat = one(query.seat);
  return <Shell><main className="page correction-page">
    <p className="eyebrow">RELEASE CORRECTION / REVIEW QUEUE</p>
    <h1>Submit a correction</h1>
    <p className="lede">Point us to a specific published record and explain what needs review.</p>
    <CorrectionForm releaseId={correctionReleaseIdSchema.safeParse(release).data} seatCycleId={correctionSeatCycleIdSchema.safeParse(seat).data} />
  </main></Shell>;
}
