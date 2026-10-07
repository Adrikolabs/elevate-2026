import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImageUp, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { checkImageFile, HEADSHOT_MAX_BYTES, INVALID_IMAGE } from "@/lib/file-rules";
import { compressImage, extensionForMime, readFileType, uploadWithProgress } from "@/lib/storage";
import { StudentAvatar } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export async function validateImage(file: File, maxBytes: number) {
  const check = checkImageFile(file, maxBytes);
  if (!check.ok) return check;
  const real = await readFileType(file);
  if (real !== "jpeg" && real !== "png" && real !== "webp") return INVALID_IMAGE;
  return check;
}

export function HeadshotUploader({ studentId, name, avatarUrl }: { studentId: string; name: string; avatarUrl: string | null }) {
  const queryClient = useQueryClient();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const check = await validateImage(f, HEADSHOT_MAX_BYTES);
    if (!check.ok) { toast.error(check.title, { description: check.message }); return; }
    setFailed(false);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const close = () => { if (progress === null) { setFile(null); setPreview(null); setFailed(false); } };

  const upload = async () => {
    if (!file) return;
    setFailed(false);
    setProgress(0);
    try {
      const blob = await compressImage(file, 800);
      const path = `${studentId}/headshot-${Date.now()}.${extensionForMime(blob.type)}`;
      const ref = await uploadWithProgress("student-headshots", path, blob, setProgress);
      const { error } = await supabase.rpc("set_my_headshot", { _path: ref });
      if (error) throw error;
      toast.success("Headshot uploaded", { description: "Your headshot has been updated successfully." });
      await queryClient.invalidateQueries();
      setProgress(null);
      setFile(null);
      setPreview(null);
    } catch {
      setProgress(null);
      setFailed(true);
    }
  };

  return (
    <div id="headshot" className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
      <StudentAvatar name={name} url={avatarUrl} size="xl" />
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">JPG, PNG or WEBP, up to 5 MB. A clear, front-facing photo works best.</p>
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button type="button" variant="gold" onClick={() => galleryRef.current?.click()}>
            <ImageUp className="h-4 w-4" /> {avatarUrl ? "Change Headshot" : "Upload Headshot"}
          </Button>
          <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()}>
            <Camera className="h-4 w-4" /> Take Photo
          </Button>
        </div>
        <input ref={galleryRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" onChange={pick} aria-label="Choose headshot from device" />
        <input ref={cameraRef} type="file" accept="image/*" capture="user" className="sr-only" onChange={pick} aria-label="Take headshot with camera" />
      </div>

      <Dialog open={!!file} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Preview your headshot</DialogTitle>
            <DialogDescription>This photo will appear on your profile, project cards and the voting page.</DialogDescription>
          </DialogHeader>
          {preview && <img src={preview} alt="Selected headshot preview" className="mx-auto aspect-square w-56 rounded-full object-cover ring-4 ring-gold/40" />}
          {progress !== null && (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-center text-sm text-muted-foreground">Uploading headshot... {progress}%</p>
            </div>
          )}
          {failed && <p className="text-center text-sm font-medium text-destructive">Upload failed. Please try again.</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()} disabled={progress !== null}>Choose another</Button>
            <Button type="button" variant="gold" onClick={upload} disabled={progress !== null}>
              {progress !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : failed ? <RotateCcw className="h-4 w-4" /> : null}
              {failed ? "Retry upload" : "Save headshot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
