import Link from "next/link";
import { notFound } from "next/navigation";
import { DwitterCanvas } from "@/components/dwitter-canvas";
import { DITTER_SKETCH_IDS } from "@/lib/art/dwitter-sketches";

type ArtPageProps = {
  params: Promise<{ art: string }>;
};

export default async function ArtPage({ params }: ArtPageProps) {
  const { art } = await params;
  const normalized = art.trim().toLowerCase();
  const isSupported = normalized === "random" || DITTER_SKETCH_IDS.includes(normalized);
  if (!isSupported) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#F3ECD8] px-6 py-12 text-[#2D3426]">
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-[#C9BD9A] bg-[#FAF5E8] p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-[#2B3125]">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-[#4B5943]">Look at this cool ascii art instead</p>
        <DwitterCanvas className="mt-6 h-[420px] w-full rounded-2xl border border-[#B8AA84] bg-black" sketchId={normalized} />
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="inline-block rounded-lg border border-[#B8AA84] px-4 py-2 text-sm font-medium text-[#40503A] transition hover:bg-[#EFE5CD]"
            href="/"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
