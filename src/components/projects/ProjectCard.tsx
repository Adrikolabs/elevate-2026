import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Star } from "lucide-react";
import type { Project } from "@/lib/data";
import { DepartmentBadge } from "@/components/common/primitives";
import { cn } from "@/lib/utils";

export function ProjectCover({ project, className }: { project: Pick<Project, "cover_image_url" | "title">; className?: string }) {
  return project.cover_image_url ? (
    <img
      src={project.cover_image_url}
      alt={`Cover image for ${project.title}`}
      loading="lazy"
      width={1280}
      height={800}
      className={cn("h-full w-full object-cover", className)}
    />
  ) : (
    <div className={cn("flex h-full w-full items-center justify-center bg-navy-gradient font-display text-2xl font-bold text-gold-warm", className)}>
      {project.title.slice(0, 1)}
    </div>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift",
        project.is_featured && "shadow-gold",
      )}
    >
      <Link to="/projects/$id" params={{ id: project.id }} className="relative block aspect-[16/10] overflow-hidden" tabIndex={-1} aria-hidden>
        <ProjectCover project={project} className="transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute left-3 top-3 rounded-full bg-navy/85 px-2.5 py-1 text-[11px] font-semibold text-navy-foreground backdrop-blur">
          {project.project_type}
        </span>
        {project.is_featured && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gold-gradient px-2.5 py-1 text-[11px] font-bold text-gold-foreground">
            <Star className="h-3 w-3" aria-hidden /> Featured
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <DepartmentBadge departmentId={project.department_id} className="self-start" />
        <h3 className="mt-3 line-clamp-1 text-lg font-bold">{project.title}</h3>
        <p className="text-sm font-medium text-royal">by {project.student?.full_name ?? "Elevate student"}</p>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">{project.description}</p>
        <Link
          to="/projects/$id"
          params={{ id: project.id }}
          className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-foreground underline-offset-4 hover:text-royal hover:underline"
        >
          View Project <ArrowUpRight className="h-4 w-4" aria-hidden />
          <span className="sr-only">: {project.title}</span>
        </Link>
      </div>
    </article>
  );
}
