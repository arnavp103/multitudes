import { headers } from "next/headers";

import { Badge } from "@multitudes/ui/badge";
import { Button } from "@multitudes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@multitudes/ui/card";

import { requireStaff, studioAuth } from "~/server/access";
import { manageUser } from "~/server/users";

/** Deliberately small user console: no impersonation, password resets, or destructive deletion. */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sessions?: string }>;
}) {
  const actor = await requireStaff("users");
  const params = await searchParams;
  const page = Math.max(0, Math.min(10000, Number(params.page) || 0));
  const result = await studioAuth().api.listUsers({
    headers: await headers(),
    query: {
      limit: 25,
      offset: Math.floor(page) * 25,
      sortBy: "createdAt",
      sortDirection: "desc",
    },
  });
  const selected = result.users.find((user) => user.id === params.sessions);
  const activeSessions = selected
    ? await studioAuth().api.listUserSessions({
        headers: await headers(),
        body: { userId: selected.id },
      })
    : null;
  return (
    <>
      <p className="eyebrow">ACCESS / PEOPLE</p>
      <h1>Users and sessions</h1>
      <p className="muted">
        Roles control Studio access. Role changes revoke existing sessions.
      </p>
      <div className="mt-8 grid gap-4">
        {result.users.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <CardTitle>{user.name}</CardTitle>
              <p className="muted">{user.email}</p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Badge>{user.banned ? "Banned" : (user.role ?? "user")}</Badge>
              <a
                href={`/users?page=${page}&sessions=${encodeURIComponent(user.id)}`}
              >
                View sessions
              </a>
              <form action={manageUser} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="operation" value="role" />
                <select
                  aria-label={`Role for ${user.email}`}
                  name="role"
                  defaultValue={user.role ?? "user"}
                  disabled={actor.user.id === user.id}
                >
                  {["user", "viewer", "evaluator", "admin"].map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
                <Button variant="outline" disabled={actor.user.id === user.id}>
                  Update role
                </Button>
              </form>
              <form action={manageUser}>
                <input type="hidden" name="userId" value={user.id} />
                <input
                  type="hidden"
                  name="operation"
                  value={user.banned ? "unban" : "ban"}
                />
                <Button variant="outline" disabled={actor.user.id === user.id}>
                  {user.banned ? "Unban" : "Ban"}
                </Button>
              </form>
              <form action={manageUser}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="operation" value="revoke" />
                <Button variant="outline">Revoke sessions</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
      {selected && activeSessions && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Active sessions for {selected.email}</CardTitle>
          </CardHeader>
          <CardContent>
            {activeSessions.sessions.map((session) => (
              <p key={session.id} className="muted">
                {session.userAgent ?? "Unknown client"} · Created{" "}
                {new Date(session.createdAt).toLocaleString()} · Expires{" "}
                {new Date(session.expiresAt).toLocaleString()}
              </p>
            ))}
            {!activeSessions.sessions.length && (
              <p className="muted">No active sessions.</p>
            )}
          </CardContent>
        </Card>
      )}
      <nav aria-label="User pages" className="mt-6 flex gap-4">
        {page > 0 && <a href={`/users?page=${page - 1}`}>Previous</a>}
        {(page + 1) * 25 < result.total && (
          <a href={`/users?page=${page + 1}`}>Next</a>
        )}
      </nav>
    </>
  );
}
