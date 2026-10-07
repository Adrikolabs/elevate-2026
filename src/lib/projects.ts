import { z } from "zod";

export const PROJECT_TYPES = [
  "Website",
  "Graphic Design",
  "Photography",
  "Film",
  "Motion Graphics",
  "Virtual Assistant Project",
  "Computer Science Project",
  "Presentation",
  "Research / Documentation",
  "Portfolio",
  "PDF Project",
  "Other",
] as const;

export type SubmissionStatus = "draft" | "pending" | "approved" | "rejected";

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  draft: "Draft",
  pending: "Pending Review",
  approved: "Approved ✓",
  rejected: "Changes Required",
};

const optionalUrl = z
  .string()
  .trim()
  .max(500, "Link is too long")
  .refine((v) => v === "" || /^https?:\/\/[^\s/?#]+\.[^\s]+$/i.test(v), "Enter a valid link starting with https://");

export const projectDraftSchema = z.object({
  title: z.string().trim().min(2, "Project title is required").max(120, "Title must be 120 characters or fewer"),
  short_description: z.string().trim().max(200, "Short description must be 200 characters or fewer"),
  description: z.string().trim().max(5000, "Full description must be 5000 characters or fewer"),
  project_type: z.enum(PROJECT_TYPES, { message: "Choose a project type" }),
  project_url: optionalUrl,
  tools: z.string().max(600),
});

export type ProjectDraft = z.infer<typeof projectDraftSchema>;

/** Extra rules that apply when the student sends the project for review. Returns error messages. */
export function submissionProblems(draft: ProjectDraft, files: { image: boolean; pdf: boolean }): string[] {
  const problems: string[] = [];
  if (!draft.short_description.trim()) problems.push("Add a short description for project cards.");
  if (!files.image && !draft.project_url.trim() && !files.pdf) {
    problems.push("Add a project image, a project link or a PDF so reviewers can see your work.");
  }
  return problems;
}

export function parseTools(value: string): string[] {
  return Array.from(new Set(value.split(",").map((t) => t.trim()).filter(Boolean))).slice(0, 20);
}

const PROJECT_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Please sign in again.",
  NOT_REGISTERED: "Your account is not linked to a registered student.",
  INACTIVE: "Your student account is inactive. Please contact Elevate Academy.",
  NO_DEPARTMENT: "Your account has no department yet. Please contact Elevate Academy.",
  TITLE_INVALID: "Project title is required (2–120 characters).",
  SHORT_TOO_LONG: "Short description must be 200 characters or fewer.",
  DESCRIPTION_TOO_LONG: "Full description is too long.",
  TYPE_INVALID: "Choose a project type.",
  URL_INVALID: "Enter a valid project link starting with https://",
  FILE_INVALID: "One of the uploaded files could not be verified. Please upload it again.",
  SHORT_REQUIRED: "Add a short description before submitting.",
  SUBMIT_INCOMPLETE: "Add a project image, link or PDF before submitting.",
};

export function projectErrorMessage(message: string | undefined) {
  if (!message) return "We couldn't save your project. Please try again.";
  const code = Object.keys(PROJECT_ERRORS).find((k) => message.includes(k));
  return code ? PROJECT_ERRORS[code]! : "We couldn't save your project. Please try again.";
}

export type CompletionItem = { label: string; done: boolean };

export function profileCompletion(input: {
  isActive: boolean;
  hasDepartment: boolean;
  hasHeadshot: boolean;
  projectStatus: SubmissionStatus | null;
  hasVoted: boolean;
}): { percent: number; items: CompletionItem[] } {
  const items: CompletionItem[] = [
    { label: "Student account activated", done: input.isActive },
    { label: "Department assigned", done: input.hasDepartment },
    { label: "Headshot uploaded", done: input.hasHeadshot },
    { label: "Project submitted", done: input.projectStatus === "pending" || input.projectStatus === "approved" },
    { label: "Vote submitted", done: input.hasVoted },
  ];
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { percent, items };
}
