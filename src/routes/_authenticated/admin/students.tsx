import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { adminStudentsQuery, logAdminAction, type AdminStudent } from "@/lib/admin";
import { useDebounce } from "@/hooks/use-debounce";
import { StudentAvatar, useDepartmentMap } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/students")({
  component: AdminStudents,
});

const studentSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  student_code: z.string().trim().max(40),
  department_id: z.string().uuid("Choose a department"),
  bio: z.string().trim().max(600),
});

function Pill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span className={on ? "rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success" : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"}>
      {on ? onLabel : offLabel}
    </span>
  );
}

function AdminStudents() {
  const { data, isLoading } = useQuery(adminStudentsQuery);
  const { departments, map } = useDepartmentMap();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const q = useDebounce(term, 300).trim().toLowerCase();
  const [dept, setDept] = useState("all");
  const [editing, setEditing] = useState<AdminStudent | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminStudent | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["students"] });
  };

  const patch = async (s: AdminStudent, values: Partial<Pick<AdminStudent, "is_active" | "is_nominee">>, description: string) => {
    if (values.is_nominee && !s.is_active) return toast.error("Only active students can become nominees.");
    const { error } = await supabase.from("students").update(values).eq("id", s.id);
    if (error) return toast.error("We couldn't update this student.");
    await logAdminAction("student_updated", "student", s.id, description);
    toast.success("Student updated");
    refresh();
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("students").delete().eq("id", deleting.id);
    if (error) toast.error("We couldn't delete this student.");
    else {
      await logAdminAction("student_deleted", "student", deleting.id, `Admin deleted ${deleting.full_name}.`);
      toast.success("Student deleted");
      refresh();
    }
    setDeleting(null);
  };

  const rows = (data ?? []).filter((s) => {
    if (dept !== "all" && s.department_id !== dept) return false;
    if (!q) return true;
    return `${s.full_name} ${s.email} ${s.student_code ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">Students</h2>
        <Button variant="gold" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add student</Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name, email or student ID" className="pl-9" aria-label="Search students" />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="sm:w-64" aria-label="Filter by department"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Nominee</TableHead>
                  <TableHead>Voting</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <StudentAvatar name={s.full_name} url={s.avatar_url} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold">{s.full_name} {s.is_demo && <span className="ml-1 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">DEMO</span>}</p>
                          <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{map.get(s.department_id ?? "")?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Switch checked={s.is_nominee} onCheckedChange={(v) => patch(s, { is_nominee: v }, `Admin ${v ? "marked" : "unmarked"} ${s.full_name} as nominee.`)} aria-label={`Nominee status for ${s.full_name}`} />
                    </TableCell>
                    <TableCell><Pill on={s.has_voted} onLabel="Voted" offLabel="Not voted" /></TableCell>
                    <TableCell><Pill on={s.is_active} onLabel={s.account_linked ? "Active" : "Active · no login yet"} offLabel="Inactive" /></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${s.full_name}`}><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(s)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => patch(s, { is_active: !s.is_active, ...(s.is_active ? { is_nominee: false } : {}) }, `Admin ${s.is_active ? "deactivated" : "activated"} ${s.full_name}.`)}>
                            {s.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(s)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No students found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {editing && <StudentDialog student={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the student, their projects, wishes and any votes they cast or received. Consider deactivating instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StudentDialog({ student, onClose, onSaved }: { student: AdminStudent | null; onClose: () => void; onSaved: () => void }) {
  const { departments } = useDepartmentMap();
  const [dept, setDept] = useState(student?.department_id ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = studentSchema.safeParse({
      full_name: f.get("full_name"),
      email: f.get("email"),
      student_code: f.get("student_code") ?? "",
      department_id: dept,
      bio: f.get("bio") ?? "",
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
    const values = { ...parsed.data, student_code: parsed.data.student_code || null, bio: parsed.data.bio || null };
    setSaving(true);
    const { error } = student
      ? await supabase.from("students").update(values).eq("id", student.id)
      : await supabase.from("students").insert(values);
    setSaving(false);
    if (error) {
      return toast.error(error.code === "23505" ? "A student with this email or ID already exists." : "We couldn't save this student.");
    }
    await logAdminAction(student ? "student_updated" : "student_added", "student", student?.id ?? null, `Admin ${student ? "updated" : "added"} ${values.full_name}.`);
    toast.success(student ? "Student updated" : "Student added");
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{student ? "Edit student" : "Add student"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5"><Label htmlFor="full_name">Full name</Label><Input id="full_name" name="full_name" defaultValue={student?.full_name} required /></div>
          <div className="space-y-1.5"><Label htmlFor="email">Registered email</Label><Input id="email" name="email" type="email" defaultValue={student?.email} required /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="student_code">Student ID</Label><Input id="student_code" name="student_code" defaultValue={student?.student_code ?? ""} /></div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger aria-label="Department"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="bio">Short bio</Label><Textarea id="bio" name="bio" defaultValue={student?.bio ?? ""} rows={3} maxLength={600} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="navy" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
