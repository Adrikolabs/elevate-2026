import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/data";
import { Countdown } from "@/components/countdown/Countdown";

export const Route = createFileRoute("/countdown")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Graduation Countdown — Elevate Academy Class of Dec 2026" },
      { name: "description", content: "Live countdown to the Elevate Academy Class of December 2026 graduation ceremony." },
      { property: "og:title", content: "Graduation Countdown — Elevate Academy" },
      { property: "og:description", content: "Days, hours, minutes and seconds until the Class of December 2026 graduates." },
    ],
  }),
  component: CountdownPage,
});

function CountdownPage() {
  const { data } = useQuery(settingsQuery);
  return (
    <section className="relative flex min-h-[80svh] items-center overflow-hidden bg-navy-gradient text-navy-foreground">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-gold/15 blur-3xl" />
      <div className="relative mx-auto w-full max-w-4xl px-4 pb-16 pt-28 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-warm">The big day</p>
        <h1 className="mt-3 text-3xl font-extrabold sm:text-5xl">{data?.graduation_title ?? "Graduation Countdown"}</h1>
        {data?.graduation_description && <p className="mx-auto mt-4 max-w-2xl text-navy-foreground/75">{data.graduation_description}</p>}
        <div className="mt-12">
          <Countdown variant="dark" />
        </div>
      </div>
    </section>
  );
}
