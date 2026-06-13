'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import Link from 'next/link';
import ConfirmModal from '@/components/ConfirmModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw,
  X,
  History,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface TicketHistoryEntry {
  id: string;
  actionType: string;
  entityId: string;
  entityType: string;
  userId: string | null;
  changes: Record<string, unknown> | null;
  reason: string | null;
  timestamp: string;
  performedBy?: { id: string; fullName: string | null; email: string } | null;
}

type DeletedTicketSnapshot = {
  ticket?: {
    id?: string;
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    status?: string;
    subcategory?: string;
    machine?: string;
    area?: string;
    source?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  attachments?: { fileName?: string }[];
};

type DeletedUserSnapshot = {
  email?: string;
  fullName?: string;
  username?: string;
  role?: string;
  isActive?: boolean;
};

const ENTITY_FILTER_OPTIONS = [
  { value: '', label: 'All entities' },
  { value: 'ticket', label: 'Tickets' },
  { value: 'user', label: 'Users' },
  { value: 'knowledge_document', label: 'PDF documents' },
  { value: 'knowledge_entry', label: 'Knowledge articles' },
  { value: 'pipeline_error', label: 'Pipeline errors' },
  { value: 'knowledge_extraction_candidate', label: 'Extraction reviews' },
  { value: 'machine_name_suggestion', label: 'Machine names' },
  { value: 'reference_data', label: 'Reference data (CSV)' },
];

const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: '__issues__', label: 'Errors & failures' },
  { value: 'reject', label: 'Rejected' },
  { value: 'approve', label: 'Approved' },
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' },
  { value: 'rollback', label: 'Restored' },
];

const EVENT_LABELS: Record<string, string> = {
  gate_rejected: 'Rejected at PDF upload review',
  gate_approved: 'PDF approved for extraction',
  ocr_run: 'OCR run on PDF',
  extraction_candidate_approved: 'PDF suggestion approved → knowledge base',
  extraction_candidate_rejected: 'PDF suggestion rejected',
  machine_name_suggestion_approved: 'Machine name approved for PDF',
  machine_name_suggestion_rejected: 'Machine name suggestion rejected',
  machine_name_suggestion_superseded: 'Other name suggestion auto-rejected',
  machine_name_suggestion: 'Technician proposed a machine name',
  reference_data_loaded: 'Sales reference data loaded at startup',
  reference_data_reloaded: 'Sales reference data reloaded (CSV updated)',
  reference_data_load_failed: 'Sales reference data load failed',
};

function formatPerformer(entry: TicketHistoryEntry): string | null {
  const p = entry.performedBy;
  if (!p) return null;
  return p.fullName?.trim() || p.email || null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  priority: 'Priority',
  title: 'Title',
  description: 'Description',
  category: 'Category',
  subcategory: 'Type',
  machine: 'Machine',
  area: 'Area',
  assignedToId: 'Assignment',
  isActive: 'Account status',
  email: 'Email',
  fullName: 'Name',
  role: 'Role',
  attachmentsAdded: 'Attachments',
};

function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (isUuid(value)) return '(user reference)';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatAssignmentChange(from: unknown, to: unknown): string {
  const hadFrom = from !== null && from !== undefined && from !== '';
  const hasTo = to !== null && to !== undefined && to !== '';
  if (!hadFrom && hasTo) return 'Assigned to a technician';
  if (hadFrom && !hasTo) return 'Unassigned';
  if (hadFrom && hasTo) return 'Reassigned to another technician';
  return 'Assignment updated';
}

function getErrorMessage(entry: TicketHistoryEntry): string | null {
  const changes = entry.changes ?? {};
  if (typeof changes.error === 'string' && changes.error.trim()) {
    return changes.error.trim();
  }
  if (entry.entityType === 'knowledge_extraction_candidate') {
    return null;
  }
  if (entry.reason?.trim()) return entry.reason.trim();
  return null;
}

/** PDF pipeline failures and logged errors — not normal approve/reject workflow. */
function isIssueEntry(entry: TicketHistoryEntry): boolean {
  if (entry.entityType === 'pipeline_error') return true;
  if (entry.entityType === 'reference_data' && entry.actionType === 'error') return true;
  if (entry.actionType === 'error') return true;
  if (
    entry.entityType === 'knowledge_extraction_candidate' ||
    entry.entityType === 'machine_name_suggestion'
  ) {
    return false;
  }
  const changes = entry.changes ?? {};
  if (typeof changes.error === 'string' && changes.error.trim()) return true;
  return false;
}

function formatFieldChange(key: string, value: unknown): string | null {
  if (key === 'deletedSnapshot' || key === 'restoredFromDelete' || key === 'error') {
    return null;
  }
  if (key === 'event' && typeof value === 'string') {
    return EVENT_LABELS[value] ?? `Event: ${value.replace(/_/g, ' ')}`;
  }
  if (key === 'documentOriginalName' && typeof value === 'string') {
    return `Document: ${value}`;
  }
  if (key === 'jobType' && typeof value === 'string') {
    return `Job: ${value.replace(/_/g, ' ')}`;
  }
  if (key === 'data_plus' && typeof value === 'number') {
    return `Orders loaded: ${value}`;
  }
  if (key === 'order_lines' && typeof value === 'number') {
    return `Order lines loaded: ${value}`;
  }
  if (key === 'articles' && typeof value === 'number') {
    return `Articles loaded: ${value}`;
  }
  if (key === 'magasins' && typeof value === 'number') {
    return `Stores loaded: ${value}`;
  }
  if (key === 'changedFiles' && Array.isArray(value) && value.length > 0) {
    return `Updated files: ${value.join(', ')}`;
  }
  if (key === 'source' && typeof value === 'string') {
    const labels: Record<string, string> = {
      startup: 'Trigger: application startup',
      file_change: 'Trigger: CSV file updated',
      manual_reload: 'Trigger: manual reload',
    };
    return labels[value] ?? `Source: ${value}`;
  }
  if (key === 'dataDir' && typeof value === 'string') {
    return `Data folder: ${value}`;
  }
  if (key === 'proposedName' && typeof value === 'string') {
    return `Suggested name: ${value}`;
  }
  if (key === 'adoptedName' && typeof value === 'string') {
    return `Adopted name: ${value}`;
  }
  if (key === 'title' && typeof value === 'string') {
    return `Item: ${value}`;
  }
  if (key === 'problemDescription' || key === 'solution') {
    return null;
  }
  if (
    key === 'reviewedById' ||
    key === 'forUserId' ||
    key === 'knowledgeEntryId' ||
    key === 'documentId' ||
    key === 'edited'
  ) {
    return null;
  }
  if (key === 'assignedToId' && value && typeof value === 'object') {
    const v = value as { from?: unknown; to?: unknown };
    if ('from' in v || 'to' in v) {
      return formatAssignmentChange(v.from, v.to);
    }
  }
  const label = FIELD_LABELS[key] ?? key.replace(/_/g, ' ');
  if (value && typeof value === 'object' && 'from' in (value as object) && 'to' in (value as object)) {
    const v = value as { from?: unknown; to?: unknown };
    if (key === 'assignedToId') return formatAssignmentChange(v.from, v.to);
    return `${label}: ${formatValue(v.from)} → ${formatValue(v.to)}`;
  }
  if (key === 'attachmentsAdded' && Array.isArray(value)) {
    return `Added ${value.length} attachment${value.length === 1 ? '' : 's'}`;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${label}: ${formatValue(value)}`;
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
      return 'Pipeline error';
    case 'knowledge_extraction_candidate':
      return 'Extraction';
    case 'machine_name_suggestion':
      return 'Machine name';
    case 'reference_data':
      return 'Reference data';
    default:
      return entityType.replace(/_/g, ' ');
  }
}

function getEntityDisplayName(entry: TicketHistoryEntry): string {
  const changes = entry.changes ?? {};
  const snap = changes.deletedSnapshot as
    | DeletedTicketSnapshot
    | DeletedUserSnapshot
    | undefined;

  if (entry.entityType === 'ticket') {
    const ticketSnap = (snap as DeletedTicketSnapshot)?.ticket;
    if (ticketSnap?.title) return ticketSnap.title;
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
    const userSnap = snap as DeletedUserSnapshot | undefined;
    if (userSnap?.fullName) return userSnap.fullName;
    if (userSnap?.email) return userSnap.email;
    if (typeof changes.fullName === 'string') return changes.fullName;
    if (typeof changes.email === 'string') return changes.email;
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
    const title = (changes.title as string) || 'Extraction item';
    return doc ? `${title} (${doc})` : title;
  }

  if (entry.entityType === 'machine_name_suggestion') {
    const proposed = (changes.proposedName as string) || (changes.adoptedName as string);
    const doc = changes.documentOriginalName as string | undefined;
    if (proposed && doc) return `"${proposed}" for ${doc}`;
    if (proposed) return `"${proposed}"`;
    return changes.documentOriginalName as string || 'Machine name suggestion';
  }

  if (entry.entityType === 'reference_data') {
    return 'Sales reference data (CSV)';
  }

  return getEntityKindLabel(entry.entityType);
}

function getPrimarySummary(entry: TicketHistoryEntry): string {
  const changes = entry.changes ?? {};
  const event = changes.event;
  if (typeof event === 'string') {
    if (event === 'extraction_candidate_approved' && changes.edited === true) {
      return 'PDF suggestion approved after edit → knowledge base';
    }
    if (EVENT_LABELS[event]) return EVENT_LABELS[event];
  }
  return getSummaryLines(entry)[0] ?? '—';
}

function getExtractionReviewBody(entry: TicketHistoryEntry) {
  const ch = entry.changes ?? {};
  if (entry.entityType !== 'knowledge_extraction_candidate') return null;
  return {
    title: (ch.title as string) || 'Untitled',
    problem: (ch.problemDescription as string) || '—',
    solution: (ch.solution as string) || '—',
    pdf: (ch.documentOriginalName as string) || null,
    edited: ch.edited === true,
  };
}

function getSummaryLines(entry: TicketHistoryEntry): string[] {
  const changes = entry.changes;
  const lines: string[] = [];
  const errMsg = getErrorMessage(entry);
  if (errMsg) lines.push(errMsg);

  if (!changes) {
    return lines.length > 0 ? lines : ['No additional details recorded.'];
  }

  if (entry.entityType === 'knowledge_extraction_candidate') {
    const event = changes.event;
    if (typeof event === 'string' && EVENT_LABELS[event]) {
      lines.push(EVENT_LABELS[event]);
    }
    if (changes.documentOriginalName) {
      lines.push(`PDF: ${String(changes.documentOriginalName)}`);
    }
    if (changes.edited === true) {
      lines.push('The text was edited before it was saved.');
    }
    if (entry.reason?.trim()) {
      lines.push(`Note: ${entry.reason.trim()}`);
    }
    return lines.length > 0 ? lines : ['PDF suggestion reviewed.'];
  }

  if (entry.entityType === 'reference_data') {
    const event = changes.event;
    if (typeof event === 'string' && EVENT_LABELS[event]) {
      lines.push(EVENT_LABELS[event]);
    }
    if (typeof changes.data_plus === 'number') {
      lines.push(`Orders loaded: ${changes.data_plus}`);
    }
    if (typeof changes.order_lines === 'number') {
      lines.push(`Order lines loaded: ${changes.order_lines}`);
    }
    if (typeof changes.articles === 'number') {
      lines.push(`Articles loaded: ${changes.articles}`);
    }
    if (typeof changes.magasins === 'number') {
      lines.push(`Stores loaded: ${changes.magasins}`);
    }
    if (Array.isArray(changes.changedFiles) && changes.changedFiles.length > 0) {
      lines.push(`Updated files: ${(changes.changedFiles as string[]).join(', ')}`);
    }
    if (typeof changes.source === 'string') {
      const labels: Record<string, string> = {
        startup: 'Trigger: application startup',
        file_change: 'Trigger: CSV file updated',
        manual_reload: 'Trigger: manual reload',
      };
      lines.push(labels[changes.source] ?? `Source: ${changes.source}`);
    }
    return lines.length > 0 ? lines : ['Reference data event recorded.'];
  }

  if (changes.deletedSnapshot) {
    lines.push(
      entry.entityType === 'ticket'
        ? 'Ticket removed from active list (snapshot saved).'
        : entry.entityType === 'user'
          ? 'User account removed (snapshot saved).'
          : 'Record removed (snapshot saved).',
    );
    return lines;
  }
  if (changes.restoredFromDelete) {
    lines.push('Restored from a previous deletion.');
    return lines;
  }

  for (const [key, value] of Object.entries(changes)) {
    const line = formatFieldChange(key, value);
    if (line && !lines.includes(line)) lines.push(line);
  }
  return lines.length > 0 ? lines : ['Change recorded.'];
}

function getActionBadgeVariant(
  actionType: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (actionType) {
    case 'create':
      return 'default';
    case 'update':
      return 'secondary';
    case 'delete':
    case 'reject':
    case 'error':
      return 'destructive';
    case 'rollback':
      return 'outline';
    case 'approve':
      return 'default';
    default:
      return 'secondary';
  }
}

function formatAction(actionType: string): string {
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

function HistoryDetailModal({
  entry,
  onClose,
}: {
  entry: TicketHistoryEntry;
  onClose: () => void;
}) {
  const summary = getSummaryLines(entry);
  const extractionBody = getExtractionReviewBody(entry);
  const name = getEntityDisplayName(entry);
  const kind = getEntityKindLabel(entry.entityType);
  const snap = entry.changes?.deletedSnapshot as
    | DeletedTicketSnapshot
    | DeletedUserSnapshot
    | undefined;
  const ticketSnap = (snap as DeletedTicketSnapshot)?.ticket;
  const userSnap = snap as DeletedUserSnapshot | undefined;
  const errorMessage = getErrorMessage(entry);
  const isErrorLike =
    entry.actionType === 'error' ||
    entry.actionType === 'reject' ||
    entry.entityType === 'pipeline_error';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <Card
        accentBand
        className="max-h-[85vh] w-full max-w-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="space-y-1 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getActionBadgeVariant(entry.actionType)} className="capitalize">
                {formatAction(entry.actionType)}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {kind}
              </Badge>
            </div>
            <CardTitle className="text-lg leading-snug">{name}</CardTitle>
            <CardDescription>
              {new Date(entry.timestamp).toLocaleString()}
              {formatPerformer(entry) && (
                <> · By {formatPerformer(entry)}</>
              )}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="max-h-[60vh] space-y-4 overflow-y-auto">
          {isErrorLike && errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {(entry.entityType === 'pipeline_error' ||
            entry.entityType === 'knowledge_document' ||
            (entry.entityType === 'knowledge_extraction_candidate' &&
              typeof entry.changes?.documentId === 'string')) && (
            <Button variant="outline" size="sm" asChild className="w-fit">
              <Link
                href={`/dashboard/admin/knowledge-docs/${
                  entry.entityType === 'knowledge_extraction_candidate'
                    ? String(entry.changes?.documentId)
                    : entry.entityId
                }`}
              >
                Open PDF in admin
              </Link>
            </Button>
          )}

          {extractionBody && (
            <div className="space-y-3 rounded-lg border border-border/50 bg-muted/15 p-3 text-sm">
              <p className="font-semibold leading-snug">{extractionBody.title}</p>
              <p className="leading-relaxed">
                <span className="font-medium">Problem — </span>
                {extractionBody.problem}
              </p>
              <p className="leading-relaxed">
                <span className="font-medium">Solution — </span>
                {extractionBody.solution}
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Summary
            </p>
            <ul className="space-y-1.5 text-sm">
              {summary.map((line, i) => (
                <li key={i} className="rounded-md bg-muted/40 px-3 py-2">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {entry.actionType === 'delete' && ticketSnap && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ticket at deletion
              </p>
              <div className="space-y-2 text-sm rounded-lg border border-border/60 p-3">
                {ticketSnap.status && (
                  <p>
                    <span className="text-muted-foreground">Status: </span>
                    <span className="font-medium capitalize">
                      {ticketSnap.status.replace(/_/g, ' ')}
                    </span>
                  </p>
                )}
                {ticketSnap.priority && (
                  <p>
                    <span className="text-muted-foreground">Priority: </span>
                    <span className="font-medium capitalize">{ticketSnap.priority}</span>
                  </p>
                )}
                {ticketSnap.category && (
                  <p>
                    <span className="text-muted-foreground">Category: </span>
                    <span className="font-medium capitalize">{ticketSnap.category}</span>
                  </p>
                )}
                {ticketSnap.area && (
                  <p>
                    <span className="text-muted-foreground">Area: </span>
                    <span className="font-medium">{ticketSnap.area}</span>
                  </p>
                )}
                {ticketSnap.machine && (
                  <p>
                    <span className="text-muted-foreground">Machine: </span>
                    <span className="font-medium">{ticketSnap.machine}</span>
                  </p>
                )}
                {ticketSnap.description && (
                  <div>
                    <p className="text-muted-foreground mb-1">Description</p>
                    <p className="whitespace-pre-wrap text-foreground/90">{ticketSnap.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {entry.actionType === 'delete' && userSnap && (userSnap.email || userSnap.fullName) && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                User at deletion
              </p>
              <dl className="space-y-1 text-sm rounded-lg border border-border/60 p-3">
                {userSnap.fullName && (
                  <p>
                    <span className="text-muted-foreground">Name: </span>
                    {userSnap.fullName}
                  </p>
                )}
                {userSnap.email && (
                  <p>
                    <span className="text-muted-foreground">Email: </span>
                    {userSnap.email}
                  </p>
                )}
                {userSnap.role && (
                  <p>
                    <span className="text-muted-foreground">Role: </span>
                    <span className="capitalize">{userSnap.role}</span>
                  </p>
                )}
              </dl>
            </div>
          )}

          {entry.entityType === 'ticket' &&
            entry.actionType !== 'delete' &&
            !entry.changes?.deletedSnapshot && (
              <p className="text-xs text-muted-foreground">
                This ticket may still exist. Open it from the tickets list if you need the live
                record.
              </p>
            )}

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Technical reference</summary>
            <p className="mt-2 font-mono break-all rounded bg-muted/50 p-2">{entry.entityId}</p>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

const HISTORY_PAGE_SIZE = 10;

export default function TicketHistoryPage() {
  const [history, setHistory] = useState<TicketHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<TicketHistoryEntry | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<TicketHistoryEntry | null>(null);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<TicketHistoryEntry[]>('/tickets/history', {
        params: { limit: 300, includeErrors: true },
      });
      setHistory(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((entry) => {
      if (entityFilter && entry.entityType !== entityFilter) return false;
      if (actionFilter === '__issues__') {
        if (!isIssueEntry(entry)) return false;
      } else if (actionFilter && entry.actionType !== actionFilter) {
        return false;
      }
      if (!q) return true;
      const name = getEntityDisplayName(entry).toLowerCase();
      const summary = getSummaryLines(entry).join(' ').toLowerCase();
      const kind = getEntityKindLabel(entry.entityType).toLowerCase();
      const err = (getErrorMessage(entry) ?? '').toLowerCase();
      return name.includes(q) || summary.includes(q) || kind.includes(q) || err.includes(q);
    });
  }, [history, entityFilter, actionFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));

  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * HISTORY_PAGE_SIZE;
    return filteredHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredHistory, page]);

  const startIndex =
    filteredHistory.length === 0 ? 0 : (page - 1) * HISTORY_PAGE_SIZE + 1;
  const endIndex = Math.min(page * HISTORY_PAGE_SIZE, filteredHistory.length);

  useEffect(() => {
    setPage(1);
  }, [entityFilter, actionFilter, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const issueCount = useMemo(
    () => history.filter((e) => isIssueEntry(e)).length,
    [history],
  );

  const isTicket = (entry: TicketHistoryEntry) => entry.entityType === 'ticket';
  const isUser = (entry: TicketHistoryEntry) => entry.entityType === 'user';

  const requestRestore = (entry: TicketHistoryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.actionType !== 'delete') return;
    if (!isTicket(entry) && !isUser(entry)) return;
    setRestoreTarget(entry);
  };

  const confirmRestore = async () => {
    const entry = restoreTarget;
    if (!entry || entry.actionType !== 'delete' || restoringId) return;

    setRestoringId(entry.id);
    try {
      if (isTicket(entry)) {
        await api.post(`/tickets/${entry.entityId}/restore`);
        toast.success('Ticket restored');
      } else if (isUser(entry)) {
        const { data } = await api.post<{ passwordWasRegenerated?: boolean }>(
          `/users/${entry.entityId}/restore`,
        );
        if (data.passwordWasRegenerated) {
          toast.success(
            'User restored. Set a new password in Users — their old login will not work until you do.',
            { duration: 8000 },
          );
        } else {
          toast.success('User restored');
        }
      }
      void fetchHistory();
      setSelectedEntry(null);
      setRestoreTarget(null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to restore';
      toast.error(message);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Activity Log" showSidebar={true}>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Activity log</h2>
            {issueCount > 0 && (
              <div className="mt-2">
                <Badge variant="destructive" className="font-normal">
                  {issueCount} error{issueCount === 1 ? '' : 's'} in recent activity
                </Badge>
               
              </div>
            )}
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5 text-muted-foreground" />
                  Recent activity
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-2 w-fit" onClick={() => void fetchHistory()}>
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <Label htmlFor="log-search">Search</Label>
                  <Input
                    id="log-search"
                    placeholder="Name, summary, type…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2 w-full sm:w-[180px]">
                  <Label htmlFor="entity-filter">Entity</Label>
                  <Select
                    id="entity-filter"
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value)}
                  >
                    {ENTITY_FILTER_OPTIONS.map((o) => (
                      <option key={o.value || 'all'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2 w-full sm:w-[160px]">
                  <Label htmlFor="action-filter">Action</Label>
                  <Select
                    id="action-filter"
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                  >
                    {ACTION_FILTER_OPTIONS.map((o) => (
                      <option key={o.value || 'all'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading…
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  {history.length === 0
                    ? 'No activity recorded yet.'
                    : 'No entries match your filters.'}
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>When</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>By</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead className="text-right w-[100px]"> </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedHistory.map((entry) => {
                        const summary = getSummaryLines(entry);
                        const primarySummary = getPrimarySummary(entry);
                        const issue = isIssueEntry(entry);
                        return (
                          <TableRow
                            key={entry.id}
                            className={cn(
                              'cursor-pointer transition-colors hover:bg-muted/40',
                              issue && 'bg-destructive/[0.03]',
                            )}
                            onClick={() => setSelectedEntry(entry)}
                          >
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                                <Badge
                                  variant={getActionBadgeVariant(entry.actionType)}
                                  className="w-fit capitalize text-xs"
                                >
                                  {formatAction(entry.actionType)}
                                </Badge>
                                <span className="text-sm font-medium text-foreground">
                                  <span className="text-muted-foreground font-normal">
                                    {getEntityKindLabel(entry.entityType)} ·{' '}
                                  </span>
                                  {getEntityDisplayName(entry)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatPerformer(entry) ?? '—'}
                            </TableCell>
                            <TableCell className="text-sm max-w-md">
                              <span
                                className={cn(
                                  issue ? 'text-destructive/90' : 'text-muted-foreground',
                                )}
                              >
                                {primarySummary}
                              </span>
                              {summary.length > 1 && (
                                <span className="text-xs text-muted-foreground">
                                  {' '}
                                  (+{summary.length - 1} more)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {entry.actionType === 'delete' &&
                                (isTicket(entry) || isUser(entry)) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={restoringId === entry.id}
                                    onClick={(e) => requestRestore(entry, e)}
                                  >
                                    {restoringId === entry.id ? '…' : 'Restore'}
                                  </Button>
                                )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="flex flex-col gap-2 border-t border-border/50 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Showing {startIndex}–{endIndex} of {filteredHistory.length}
                      {filteredHistory.length !== history.length
                        ? ` (${history.length} loaded)`
                        : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedEntry && (
          <HistoryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
        )}

        <ConfirmModal
          isOpen={!!restoreTarget}
          title="Restore this item?"
          message={
            restoreTarget
              ? isTicket(restoreTarget)
                ? `Restore the ticket "${getEntityDisplayName(restoreTarget)}"? It will appear again in the active tickets list.`
                : `Restore the user account "${getEntityDisplayName(restoreTarget)}"? They may need a new password set in Users before they can sign in again.`
              : ''
          }
          confirmText={restoringId ? 'Restoring…' : 'Restore'}
          cancelText="Cancel"
          type="info"
          onConfirm={() => void confirmRestore()}
          onCancel={() => {
            if (!restoringId) setRestoreTarget(null);
          }}
        />
      </Layout>
    </ProtectedRoute>
  );
}
