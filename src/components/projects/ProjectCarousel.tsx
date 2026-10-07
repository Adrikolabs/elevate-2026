import { useEffect, useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import type { Project } from "@/lib/data";
import { ProjectCard } from "./ProjectCard";
import { cn } from "@/lib/utils";

export function ProjectCarousel({ projects, label = "Featured projects" }: { projects: Project[]; label?: string }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  const autoplay = useRef(Autoplay({ delay: 4500, stopOnInteraction: true, stopOnMouseEnter: true }));

  useEffect(() => {
    if (!api) return;
    const update = () => {
      setSnaps(api.scrollSnapList());
      setSelected(api.selectedScrollSnap());
    };
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  return (
    <section aria-roledescription="carousel" aria-label={label}>
      <Carousel setApi={setApi} opts={{ align: "start", loop: projects.length > 3 }} plugins={[autoplay.current]} className="px-0 sm:px-12">
        <CarouselContent className="-ml-5 py-3">
          {projects.map((p, i) => (
            <CarouselItem key={p.id} className="basis-full pl-5 sm:basis-1/2 lg:basis-1/3" aria-label={`Slide ${i + 1} of ${projects.length}`}>
              <ProjectCard project={p} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-0 hidden sm:inline-flex" aria-label="Previous project" />
        <CarouselNext className="right-0 hidden sm:inline-flex" aria-label="Next project" />
      </Carousel>
      {snaps.length > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {snaps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                autoplay.current.stop();
                api?.scrollTo(i);
              }}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === selected}
              className={cn("h-2.5 rounded-full transition-all", i === selected ? "w-8 bg-gold" : "w-2.5 bg-border hover:bg-muted-foreground/40")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
