/**
 * Human-readable notification copy (shared by header dropdown and notification pages).
 */

export type NotificationEntryInput = {
  id: string;
  actionType: string;
  entityId: string;
  entityType: string;
  timestamp: string;
  ticketTitle?: string;
  changes?: Record<string, unknown> | null;
  reason?: string | null;
};

export type AppRole = 'admin' | 'superadmin' | 'technician' | 'worker';

export type NotificationPreview = {
  headline: string;
  entityLabel: string;
  detail: string;
  href: string;
  linkable: boolean;
  actionLabel: string;
  actionVariant: 'default' | 'secondary' | 'destructive' | 'outline';
};

const EVENT_LABELS: Record<string, string> = {
  gate_rejected: 'PDF rejected at upload review',
  gate_approved: 'PDF approved for extraction',
  ocr_run: 'OCR run on PDF',
  extraction_candidate_approved: 'PDF suggestion saved to knowledge base',
  extraction_candidate_rejected: 'PDF suggestion rejected',
  machine_name_suggestion_approved: 'Machine name approved',
  machine_name_suggestion_rejected: 'Machine name suggestion rejected',
  machine_name_suggestion_superseded: 'Machine name suggestion closed',
  machine_name_suggestion: 'New machine name suggested',
  knowledge_entry_approved: 'Solution approved',
  knowledge_entry_rejected: 'Solution rejected',
  knowledge_entry_submitted: 'New solution submitted for review',
};

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  priority: 'Priority',
  title: 'Title',
  assignedToId: 'Assignment',
};

type DeletedTicketSnapshot = {
  ticket?: { title?: string };
};

function formatAssignmentChange(from: unknown, to: unknown): string {
  const hadFrom = from !== null && from !== undefined && from !== '';
  const hasTo = to !== null && to !== undefined && to !== '';
  if (!hadFrom && hasTo) return 'Assigned to a technician';
  if (hadFrom && !hasTo) return 'Unassigned';
  if (hadFrom && hasTo) return 'Reassigned';
  return 'Assignment updated';
}

function formatFieldChange(key: string, value: unknown): string | null {
  if (['deletedSnapshot', 'restoredFromDelete', 'error', 'source', 'event'].includes(key)) {
    if (key === 'event' && typeof value === 'string') {
      return EVENT_LABELS[value] ?? null;
    }
    return null;
  }
  if (key === 'documentOriginalName' && typeof value === 'string') {
    return `Document: ${value}`;
  }
  if (key === 'assignedToId' && value && typeof value === 'object') {
    const v = value as { from?: unknown; to?: unknown };
    if ('from' in v || 'to' in v) return formatAssignmentChange(v.from, v.to);
  }
  const label = FIELD_LABELS[key] ?? key.replace(/_/g, ' ');
  if (value && typeof value === 'object' && 'from' in (value as object) && 'to' in (value as object)) {
    const v = value as { from?: unknown; to?: unknown };
    if (key === 'assignedToId') return formatAssignmentChange(v.from, v.to);
    const from = v.from === null || v.from === undefined ? '—' : String(v.from);
    const to = v.to === null || v.to === undefined ? '—' : String(v.to);
    return `${label}: ${from} → ${to}`;
  }
  if (key === 'attachmentsAdded' && Array.isArray(value)) {
    return `${value.length} attachment${value.length === 1 ? '' : 's'} added`;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${label}: ${String(value)}`;
  }
  return null;
}

function getEntityKindLabel(entityType: string): string {
  switch (entityType) {
    case 'ticket':
      return 'Ticket';
    case 'user':
      return 'User';
    case 'knowledge_document':
      return 'PDF';
    case 'knowledge_entry':
      return 'Knowledge';
    case 'pipeline_error':
      return 'Pipeline';
    case 'knowledge_extraction_candidate':
      return 'PDF review';
    case 'machine_name_suggestion':
      return 'Machine name';
    default:
      return entityType.replace(/_/g, ' ');
  }
}

export function getEntityDisplayName(entry: NotificationEntryInput): string {
  const changes = entry.changes ?? {};
  const snap = changes.deletedSnapshot as DeletedTicketSnapshot | undefined;

  if (entry.entityType === 'ticket') {
    if (entry.ticketTitle?.trim()) return entry.ticketTitle.trim();
    if (snap?.ticket?.title) return snap.ticket.title;
    const titleChange = changes.title;
    if (typeof titleChange === 'string') return titleChange;
    if (titleChange && typeof titleChange === 'object') {
      if ('to' in titleChange) return String((titleChange as { to: unknown }).to);
      if ('from' in titleChange) return String((titleChange as { from: unknown }).from);
    }
    if (entry.actionType === 'create' && typeof changes.title === 'string') {
      return changes.title;
    }
    return 'Ticket';
  }

  if (entry.entityType === 'user') {
    const userSnap = snap as { fullName?: string; email?: string } | undefined;
    if (userSnap?.fullName) return userSnap.fullName;
    if (userSnap?.email) return userSnap.email;
    return 'User account';
  }

  if (entry.entityType === 'knowledge_document' || entry.entityType === 'pipeline_error') {
    return (
      (changes.documentOriginalName as string) ||
      (changes.originalName as string) ||
      'PDF document'
    );
  }

  if (entry.entityType === 'knowledge_entry') {
    return (changes.title as string) || 'Knowledge article';
  }

  if (entry.entityType === 'knowledge_extraction_candidate') {
    const doc = changes.documentOriginalName as string | undefined;
    const title = (changes.title as string) || 'Suggestion';
    return doc ? `${title} · ${doc}` : title;
  }

  if (entry.entityType === 'machine_name_suggestion') {
    const proposed = (changes.proposedName as string) || (changes.adoptedName as string);
    const doc = changes.documentOriginalName as string | undefined;
    if (proposed && doc) return `"${proposed}" · ${doc}`;
    if (proposed) return `"${proposed}"`;
    return (changes.documentOriginalName as string) || 'Machine name';
  }

  return getEntityKindLabel(entry.entityType);
}

function getSummaryDetail(entry: NotificationEntryInput): string {
  const changes = entry.changes ?? {};
  if (typeof changes.error === 'string' && changes.error.trim()) {
    return changes.error.trim();
  }
  if (entry.reason?.trim()) return entry.reason.trim();

  const event = changes.event;
  if (typeof event === 'string') {
    if (event === 'extraction_candidate_approved' && changes.edited === true) {
      return 'Approved after edit and saved to the knowledge base.';
    }
    if (EVENT_LABELS[event]) return EVENT_LABELS[event];
  }

  if (changes.deletedSnapshot) {
    if (entry.entityType === 'ticket') {
      return 'Removed from the active list. An admin can restore it from the activity log.';
    }
    if (entry.entityType === 'user') {
      return 'User account removed. Details were saved in the activity log.';
    }
    return 'Record removed. Snapshot saved in the activity log.';
  }

  if (changes.restoredFromDelete) {
    return 'Restored from a previous deletion.';
  }

  const lines: string[] = [];
  for (const [key, value] of Object.entries(changes)) {
    const line = formatFieldChange(key, value);
    if (line && !lines.includes(line)) lines.push(line);
  }
  if (lines.length > 0) return lines.slice(0, 2).join(' · ');

  return 'Change recorded in the system.';
}

function formatActionLabel(actionType: string): string {
  switch (actionType) {
    case 'create':
      return 'Created';
    case 'update':
      return 'Updated';
    case 'delete':
      return 'Deleted';
    case 'rollback':
      return 'Restored';
    case 'approve':
      return 'Approved';
    case 'reject':
      return 'Rejected';
    case 'error':
      return 'Error';
    default:
      return actionType.replace(/_/g, ' ');
  }
}

function actionVariant(actionType: string): NotificationPreview['actionVariant'] {
  switch (actionType) {
    case 'delete':
    case 'reject':
    case 'error':
      return 'destructive';
    case 'create':
    case 'approve':
      return 'default';
    case 'rollback':
      return 'outline';
    default:
      return 'secondary';
  }
}

function getHeadline(entry: NotificationEntryInput, role: AppRole): string {
  const event = entry.changes?.event;
  if (typeof event === 'string' && EVENT_LABELS[event]) {
    return EVENT_LABELS[event];
  }

  const kind = getEntityKindLabel(entry.entityType);

  if (role === 'worker') {
    if (entry.entityType === 'ticket') {
      switch (entry.actionType) {
        case 'create':
          return 'Your ticket was created';
        case 'update':
          return 'Your ticket was updated';
        case 'delete':
          return 'Your ticket was deleted';
        case 'rollback':
          return 'Your ticket was restored';
        default:
          break;
      }
    }
    if (entry.entityType === 'knowledge_entry') {
      return EVENT_LABELS[String(event)] ?? 'Knowledge update';
    }
  }

  if (role === 'technician') {
    if (entry.entityType === 'ticket') {
      switch (entry.actionType) {
        case 'create':
          return 'New ticket activity';
        case 'update':
          return 'Ticket updated';
        case 'delete':
          return 'Ticket removed';
        case 'rollback':
          return 'Ticket restored';
        default:
          break;
      }
    }
    if (entry.entityType === 'machine_name_suggestion') {
      return EVENT_LABELS[String(event)] ?? 'Machine name update';
    }
  }

  switch (entry.actionType) {
    case 'delete':
      if (entry.entityType === 'ticket') return 'Ticket deleted';
      if (entry.entityType === 'user') return 'User account deleted';
      return `${kind} deleted`;
    case 'create':
      return `${kind} created`;
    case 'update':
      return `${kind} updated`;
    case 'rollback':
      return `${kind} restored`;
    case 'approve':
      return `${kind} approved`;
    case 'reject':
      return `${kind} rejected`;
    case 'error':
      return entry.entityType === 'pipeline_error' ? 'PDF pipeline failed' : `${kind} error`;
    default:
      return `${kind} · ${formatActionLabel(entry.actionType)}`;
  }
}

export function getNotificationHref(entry: NotificationEntryInput, role: AppRole): string {
  const ch = entry.changes ?? {};
  const isAdmin = role === 'admin' || role === 'superadmin';

  if (entry.actionType === 'delete' && entry.entityType === 'ticket') {
    if (isAdmin) return '/dashboard/admin/history';
    if (role === 'worker') return '/dashboard/worker/notifications';
    return '/dashboard/technician/notifications';
  }

  if (entry.entityType === 'user' && isAdmin) return '/dashboard/admin/users';

  if (entry.entityType === 'knowledge_document' && isAdmin) {
    return `/dashboard/admin/knowledge-docs/${entry.entityId}`;
  }

  if (entry.entityType === 'pipeline_error' && isAdmin) {
    return `/dashboard/admin/knowledge-docs/${entry.entityId}`;
  }

  if (entry.entityType === 'knowledge_extraction_candidate' && isAdmin) {
    const docId = ch.documentId;
    if (typeof docId === 'string') return `/dashboard/admin/knowledge-docs/${docId}`;
    return '/dashboard/admin/extraction-feedback';
  }

  if (entry.entityType === 'machine_name_suggestion') {
    if (typeof ch.documentId === 'string') {
      return role === 'technician'
        ? `/dashboard/technician/knowledge-pdfs/${ch.documentId}`
        : `/dashboard/admin/knowledge-docs/${ch.documentId}`;
    }
    return isAdmin ? '/dashboard/admin/knowledge-docs' : '/dashboard/technician/notifications';
  }

  if (entry.entityType === 'knowledge_entry') {
    if (isAdmin) return '/dashboard/admin/knowledge';
    if (role === 'worker') return '/dashboard/worker/knowledge';
    return '/dashboard/technician/knowledge';
  }

  if (entry.entityType === 'ticket') {
    return `/dashboard/tickets/${entry.entityId}`;
  }

  return isAdmin ? '/dashboard/admin/history' : '/dashboard/worker/notifications';
}

export function buildNotificationPreview(
  entry: NotificationEntryInput,
  role: AppRole,
): NotificationPreview {
  const entityLabel = getEntityDisplayName(entry);
  const headline = getHeadline(entry, role);
  let detail = getSummaryDetail(entry);

  if (
    entry.actionType === 'update' &&
    entry.entityType === 'ticket' &&
    detail === 'Change recorded in the system.'
  ) {
    detail = 'Fields on this ticket were changed.';
  }

  const deletedTicket =
    entry.actionType === 'delete' && entry.entityType === 'ticket';
  const linkable = !(deletedTicket && (role === 'worker' || role === 'technician'));

  return {
    headline,
    entityLabel,
    detail,
    href: getNotificationHref(entry, role),
    linkable,
    actionLabel: formatActionLabel(entry.actionType),
    actionVariant: actionVariant(entry.actionType),
  };
}

export function formatNotificationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
