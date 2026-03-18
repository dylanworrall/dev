import { NextResponse } from "next/server";
import { listWatchers, createWatcher, updateWatcher, deleteWatcher, listEvents, getUnseenCount } from "@/lib/stores/watchers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "events") {
    const watcherId = searchParams.get("watcherId") || undefined;
    const events = await listEvents(watcherId);
    const unseenCount = await getUnseenCount();
    return NextResponse.json({ events, unseenCount });
  }

  const watchers = await listWatchers();
  const unseenCount = await getUnseenCount();
  return NextResponse.json({ watchers, unseenCount });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const watcher = await createWatcher({
      name: body.name,
      repoFullName: body.repoFullName,
      enabled: true,
      watchIssues: body.watchIssues ?? true,
      watchCommits: body.watchCommits ?? true,
      watchBranches: body.watchBranches ?? false,
      watchPRs: body.watchPRs ?? true,
      notifyUser: body.notifyUser ?? true,
      reportToAgent: body.reportToAgent ?? false,
    });
    return NextResponse.json(watcher);
  }

  if (action === "update" && body.id) {
    const watcher = await updateWatcher(body.id, body.updates);
    return NextResponse.json(watcher || { error: "Not found" });
  }

  if (action === "delete" && body.id) {
    const deleted = await deleteWatcher(body.id);
    return NextResponse.json({ deleted });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
