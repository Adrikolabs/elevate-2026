<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Voting writes go only through the `cast_vote` database function; `votes` has no insert/update/delete policies — never add them (keeps the department/one-vote rules server-enforced).
- Student email/phone are hidden via column-level grants: always select `STUDENT_PUBLIC_COLUMNS` (src/lib/data.ts), never `*`, on `students`; admins read private fields via the `admin_list_students` RPC.
- Auth accounts link to `students`/`admins` rows by matching confirmed email (DB triggers); admin privilege lives only in `user_roles`, granted when an `admins` row's email matches.
- Data reads use TanStack Query option factories in src/lib/data.ts and src/lib/admin.ts with the browser client (RLS applies); no server functions needed yet.
- Admin pages live under `src/routes/_authenticated/admin/`; the layout checks `has_role` and the root layout hides the public header there.
- Admin actions write an `audit_logs` row via `logAdminAction` (RLS requires admin_id = auth.uid()).
