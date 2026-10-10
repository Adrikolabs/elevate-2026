import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, ImageUp, Loader2, Send, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { myProjectQuery } from "@/lib/data";
import { checkPdfFile, PROJECT_IMAGE_MAX_BYTES } from "@/lib/file-rules";
import { parseTools, PROJECT_TYPES, projectDraftSchema, projectErrorMessage, STATUS_LABEL, submissionProblems } from "@/lib/projects";
import { compressImage, extensionForMime, readFileType, uploadWithProgress, useFileUrl } from "@/lib/storage";
import { validateImage } from "@/components/uploads/HeadshotUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ProjectSubmission({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useQuery(myProjectQuery(studentId));
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const existingCover = useFileUrl(project?.cover_image_url);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const locked = project?.submission_status === "pending" || project?.submission_status === "approved";

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const check = await validateImage(f, PROJECT_IMAGE_MAX_BYTES);
    if (!check.ok) return void toast.error(check.title, { description: check.message });
    setImage(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const pickPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const check = checkPdfFile(f);
    if (!check.ok) return void toast.error(check.title, { description: check.message });
    if ((await readFileType(f)) !== "pdf") return void toast.error("Invalid PDF", { description: "Please upload a valid PDF document." });
    setPdf(f);
  };

  const save = async (form: HTMLFormElement, submit: boolean) => {
    const f = new FormData(form);
    const parsed = projectDraftSchema.safeParse({
      title: f.get("title") ?? "",
      short_description: f.get("short_description") ?? "",
      description: f.get("description") ?? "",
      project_type: f.get("project_type") ?? "",
      project_url: f.get("project_url") ?? "",
      tools: f.get("tools") ?? "",
    });
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message);
    if (submit) {
      const problems = submissionProblems(parsed.data, { image: !!image || !!project?.cover_image_url, pdf: !!pdf || !!project?.document_url });
      if (problems.length) return void toast.error(problems[0]);
    }
    setBusy(true);
    try {
      let cover = project?.cover_image_url ?? "";
      let doc = project?.document_url ?? "";
      const stamp = Date.now();
      if (image) {
        const blob = await compressImage(image, 1920);
        setProgress(0);
        cover = await uploadWithProgress("project-images", `${studentId}/cover-${stamp}.${extensionForMime(blob.type)}`, blob, setProgress);
      }
      if (pdf) {
        setProgress(0);
        doc = await uploadWithProgress("project-pdfs", `${studentId}/project-${stamp}.pdf`, pdf, setProgress);
      }
      const { error } = await supabase.rpc("save_my_project", {
        _title: parsed.data.title,
        _short_description: parsed.data.short_description,
        _description: parsed.data.description,
        _project_type: parsed.data.project_type,
        _project_url: parsed.data.project_url,
        _cover_image_url: cover,
        _document_url: doc,
        _tools_used: parseTools(parsed.data.tools),
        _submit: submit,
      });
      if (error) throw error;
      toast.success(submit ? "Project submitted for review 🎉" : "Draft saved");
      setImage(null); setImagePreview(null); setPdf(null);
      queryClient.invalidateQueries({ queryKey: ["my-project", studentId] });
    } catch (err) {
      toast.error(err instanceof Error && err.message.startsWith("UPLOAD") ? "Upload failed. Please check your connection and try again." : projectErrorMessage(err instanceof Error ? err.message : (err as { message?: string })?.message));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const cover = imagePreview ?? existingCover;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(e.currentTarget, true); }}
      className="rounded-2xl border bg-card p-6 shadow-soft"
      key={project?.updated_at ?? "new"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Upload your project work</h2>
          <p className="text-sm text-muted-foreground">Save a draft anytime, then submit it for review. Approved projects appear on the Projects page.</p>
        </div>
        {project && <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-primary">{STATUS_LABEL[project.submission_status]}</span>}
      </div>
      {project?.submission_status === "rejected" && project.admin_feedback && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-bold text-destructive">Feedback from Elevate Academy</p>
          <p className="mt-0.5 text-muted-foreground">{project.admin_feedback}</p>
        </div>
      )}
      {locked && <p className="mt-4 text-sm text-muted-foreground">Your project is {project?.submission_status === "approved" ? "approved" : "under review"} and can't be edited right now.</p>}

      <fieldset disabled={locked || busy} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="title">Project title</Label><Input id="title" name="title" maxLength={120} defaultValue={project?.title ?? ""} required /></div>
        <div className="space-y-1.5">
          <Label htmlFor="project_type">Project type</Label>
          <select id="project_type" name="project_type" className={selectCls} defaultValue={project?.project_type && (PROJECT_TYPES as readonly string[]).includes(project.project_type) ? project.project_type : ""}>
            <option value="" disabled>Choose a type</option>
            {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="project_url">Project link <span className="text-muted-foreground">(optional)</span></Label><Input id="project_url" name="project_url" type="url" placeholder="https://" defaultValue={project?.project_url ?? ""} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="short_description">Short description</Label><Input id="short_description" name="short_description" maxLength={200} defaultValue={project?.short_description ?? ""} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="description">Full description</Label><Textarea id="description" name="description" rows={4} maxLength={5000} defaultValue={project?.description ?? ""} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="tools">Tools used <span className="text-muted-foreground">(comma separated)</span></Label><Input id="tools" name="tools" placeholder="Figma, Photoshop, React" defaultValue={project?.tools_used?.join(", ") ?? ""} /></div>

        <div className="space-y-2">
          <Label>Project image</Label>
          {cover && <img src={cover} alt="Project cover preview" className="aspect-video w-full rounded-xl border object-cover" />}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm font-medium hover:border-primary">
            <ImageUp className="h-4 w-4" /> {cover ? "Change image" : "Upload image"} (JPG, PNG, WEBP · 10 MB)
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pickImage} />
          </label>
        </div>
        <div className="space-y-2">
          <Label>Project PDF <span className="text-muted-foreground">(optional)</span></Label>
          {(pdf || project?.document_url) && <p className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-primary" /> {pdf ? pdf.name : "PDF uploaded"}</p>}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm font-medium hover:border-primary">
            <FileText className="h-4 w-4" /> {project?.document_url || pdf ? "Replace PDF" : "Upload PDF"} (25 MB)
            <input type="file" accept="application/pdf" className="sr-only" onChange={pickPdf} />
          </label>
        </div>
      </fieldset>

      {progress !== null && <Progress value={progress} className="mt-4" />}
      {!locked && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={(e) => save(e.currentTarget.form!, false)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
          </Button>
          <Button type="submit" variant="navy" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit for review
          </Button>
        </div>
      )}
    </form>
  );
}
