import Image from "next/image";
import { ButtonLink, Card } from "@/components/ui";
import { pageMetadata } from "@/lib/seo";
import { MICHAEL_QUOTE } from "./quote";

export const metadata = pageMetadata({
  title: "Florida Ramp & Lift customer story",
  description:
    "How ResponseOS is being built and tested with Michael Keegan, founder of Florida Ramp & Lift, in a supervised pilot for the calls families make when access can't wait.",
  path: "/stories/florida-ramp-and-lift",
});

const WHY = [
  {
    title: "The calls are urgent",
    body: "Florida Ramp & Lift works with veterans, older adults, and families whose mobility needs have just changed. Many calls come from someone trying to get a person home safely, not someone comparing quotes.",
  },
  {
    title: "The team is often out on jobs",
    body: "Lifts and ramps are installed at the customer's home. The live team answers weekdays from 8 a.m. to 6 p.m. Eastern, and calls keep coming outside those hours and during installs.",
  },
  {
    title: "A missed call goes to the next company",
    body: "When nobody answers, a family in a hurry calls the next name on the list. Voicemail doesn't say how urgent the need is or whether the home is in the service area.",
  },
];

const STEPS = [
  {
    title: "Answer with consent",
    body: "The AI receptionist answers, says it is automated, and asks for consent before it records anything.",
  },
  {
    title: "Capture the need",
    body: "It is designed to capture who is calling, what access problem they have, how urgent it is, and where the home is.",
  },
  {
    title: "A person reviews it",
    body: "An operator reviews every call. Nothing is sent to a customer or written to a CRM without approval.",
  },
  {
    title: "Michael calls back",
    body: "Michael's team calls back with the whole story in front of them, instead of starting from a voicemail.",
  },
];

export default function FloridaRampAndLiftStory() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
        Customer story
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
        Built with Florida Ramp &amp; Lift, one call at a time.
      </h1>

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="max-w-2xl space-y-4 text-lg text-ink-secondary">
          <p>
            Michael Keegan founded Florida Ramp &amp; Lift in Pembroke Pines,
            Florida, to help people get in and out of the homes they love. His
            team sells and installs platform lifts, stair lifts, wheelchair
            ramps, and vehicle lifts.
          </p>
          <p>
            ResponseOS is being built and tested with Michael in a supervised
            pilot. This page tells that story as it stands today, including
            what isn&apos;t finished.
          </p>
          <figure className="border-l-2 border-accent pl-5 pt-2">
            <blockquote className="font-display text-xl text-ink">
              &ldquo;{MICHAEL_QUOTE}&rdquo;
            </blockquote>
            <figcaption className="mt-2 text-sm text-ink-muted">
              Michael Keegan, founder, Florida Ramp &amp; Lift
            </figcaption>
          </figure>
        </div>
        <figure className="w-full max-w-[280px]">
          <Image
            src="/stories/michael-keegan.webp"
            alt="Michael Keegan, founder of Florida Ramp & Lift."
            width={560}
            height={700}
            sizes="280px"
            className="rounded-lg border border-line"
            priority
          />
          <figcaption className="mt-2 text-xs text-ink-muted">
            Michael Keegan, founder,{" "}
            <a
              href="https://floridarampandlift.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-secondary hover:text-ink"
            >
              Florida Ramp &amp; Lift
            </a>
          </figcaption>
        </figure>
      </div>

      <section className="mt-16 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            The call that can&apos;t wait
          </h2>
          <Card className="mt-6">
            <blockquote className="text-lg text-ink">
              &ldquo;My father comes home from the hospital tomorrow, and we
              can&apos;t get him through the front door.&rdquo;
            </blockquote>
            <p className="mt-3 text-xs text-ink-muted">
              Illustrative. This is the kind of request Florida Ramp &amp; Lift
              receives, not a recording of a real caller.
            </p>
          </Card>
          <div className="mt-8 grid gap-6">
            {WHY.map((w) => (
              <div key={w.title} className="border-l-2 border-line-strong pl-4">
                <h3 className="text-sm font-semibold text-ink">{w.title}</h3>
                <p className="mt-1.5 text-sm text-ink-secondary">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
        <figure className="w-full max-w-[320px]">
          <Image
            src="/stories/frl-stair-lift.webp"
            alt="A man seated on a stair lift at the top of a carpeted staircase, beside a mirrored wall."
            width={720}
            height={1080}
            sizes="320px"
            className="rounded-lg border border-line"
          />
          <figcaption className="mt-2 text-xs text-ink-muted">
            Photo: Florida Ramp &amp; Lift
          </figcaption>
        </figure>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-2xl font-semibold text-ink">
          What we&apos;re building together
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full">
                <p className="font-mono text-xs text-ink-muted">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-base font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-secondary">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-20 max-w-2xl">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Where it stands
        </h2>
        <p className="mt-4 text-ink-secondary">
          This is a supervised pilot, not an unattended service. A person
          reviews every call, and Michael&apos;s team makes every callback.
          There are no results to report yet. When there are, we&apos;ll
          publish verified outcomes here and keep them separate from
          estimates.
        </p>
      </section>

      <section className="mt-20">
        <Card className="flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">
              Do your calls sound like Michael&apos;s?
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink-secondary">
              Start with the Readiness &amp; Revenue Leak Assessment. It sizes
              your missed calls and gives a straight fit / no-fit answer
              before any setup.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <ButtonLink href="/audit" glow>
              Book the Readiness Assessment
            </ButtonLink>
            <ButtonLink href="/demo/walkthrough" variant="secondary">
              See the demo
            </ButtonLink>
          </div>
        </Card>
      </section>
    </main>
  );
}
