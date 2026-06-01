'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowRight, ChevronDown, ChevronRight, RefreshCw, Terminal } from 'lucide-react';

type SchemaColumn = {
  name: string;
  description: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  default: string | null;
  maxLength: number | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencesTable: string | null;
  referencesColumn: string | null;
};

type SchemaRelation = {
  column: string;
  referencesTable: string;
  referencesColumn: string;
  enforced: boolean;
};

type SchemaTable = {
  name: string;
  group: 'core' | 'knowledge' | 'pdf' | 'system';
  purpose: string;
  entity: string | null;
  columns: SchemaColumn[];
  references: SchemaRelation[];
  referencedBy: SchemaRelation[];
};

type LiveSchema = {
  checkedAt: string;
  database: string;
  schema: string;
  tableCount: number;
  tables: SchemaTable[];
};

const GROUP_META: Record<SchemaTable['group'], { label: string; color: string }> = {
  core: { label: 'Core — users & tickets', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  knowledge: { label: 'Knowledge base', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  pdf: { label: 'PDF pipeline', color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  system: { label: 'System', color: 'bg-muted text-muted-foreground' },
};

function formatColumnType(col: SchemaColumn): string {
  let t = col.dataType;
  if (col.maxLength != null) t += `(${col.maxLength})`;
  else if (col.udtName && col.udtName !== col.dataType) t = `${t} (${col.udtName})`;
  return t;
}

function RelationList({
  relations,
  direction,
  onTableClick,
}: {
  relations: SchemaRelation[];
  direction: 'out' | 'in';
  onTableClick: (name: string) => void;
}) {
  if (relations.length === 0) {
    return <p className="text-xs text-muted-foreground italic">None</p>;
  }
  return (
    <ul className="space-y-2">
      {relations.map((r) => (
        <li
          key={`${r.referencesTable}-${r.referencesColumn}-${r.column}-${r.enforced}`}
          className="flex flex-wrap items-center gap-1.5 text-xs font-mono"
        >
          {direction === 'out' ? (
            <>
              <span className="text-foreground">{r.column}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <button
                type="button"
                onClick={() => onTableClick(r.referencesTable)}
                className="text-primary hover:underline"
              >
                {r.referencesTable}.{r.referencesColumn}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onTableClick(r.referencesTable)}
                className="text-primary hover:underline"
              >
                {r.referencesTable}.{r.referencesColumn}
              </button>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-foreground">{r.column}</span>
            </>
          )}
          {!r.enforced && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-sans">
              logical
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function DatabaseInventoryPage() {
  const [schema, setSchema] = useState<LiveSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [groupFilter, setGroupFilter] = useState<SchemaTable['group'] | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<LiveSchema>('/knowledge-documents/database-schema');
      setSchema(res.data);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(message || 'Failed to load database schema');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredTables = useMemo(() => {
    let tables = schema?.tables ?? [];
    if (groupFilter !== 'all') tables = tables.filter((t) => t.group === groupFilter);
    const q = search.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.purpose.toLowerCase().includes(q) ||
        t.columns.some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.dataType.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q),
        ) ||
        t.references.some((r) => r.referencesTable.toLowerCase().includes(q)) ||
        t.referencedBy.some((r) => r.referencesTable.toLowerCase().includes(q)),
    );
  }, [schema, search, groupFilter]);

  const groupCounts = useMemo(() => {
    const counts: Record<SchemaTable['group'], number> = { core: 0, knowledge: 0, pdf: 0, system: 0 };
    for (const t of schema?.tables ?? []) counts[t.group]++;
    return counts;
  }, [schema]);

  const jumpToTable = (name: string) => {
    setExpanded((prev) => new Set(prev).add(name));
    setSearch('');
    setGroupFilter('all');
    requestAnimationFrame(() => {
      document.getElementById(`schema-table-${name}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const toggleTable = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(filteredTables.map((t) => t.name)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Database schema" showSidebar={true}>
        <div className="space-y-6 max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Database schema</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Every table with columns and relations — what it stores and how it connects to other tables.
              </p>
              {schema && (
                <p className="text-xs text-muted-foreground mt-2">
                  {schema.database} · {schema.tableCount} tables · {new Date(schema.checkedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={expandAll} disabled={loading || filteredTables.length === 0}>
                Expand all
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} disabled={loading}>
                Collapse all
              </Button>
            </div>
          </div>

          {/* Group overview */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(['core', 'knowledge', 'pdf', 'system'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupFilter((f) => (f === g ? 'all' : g))}
                className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                  groupFilter === g ? 'border-primary ring-1 ring-primary/30' : 'border-border/60'
                }`}
              >
                <p className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${GROUP_META[g].color}`}>
                  {GROUP_META[g].label}
                </p>
                <p className="text-2xl font-bold mt-2 tabular-nums">{groupCounts[g]}</p>
                <p className="text-xs text-muted-foreground mt-1">tables</p>
              </button>
            ))}
          </div>

          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Open Postgres in Docker
              </CardTitle>
              <CardDescription>
                <code className="text-xs">docker compose exec postgres psql -U smartmaint -d smartmaint_db</code>
                {' · '}
                then <code className="text-xs">\dt</code> or <code className="text-xs">\d table_name</code>
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search table, column, or relation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            {groupFilter !== 'all' && (
              <Button variant="ghost" size="sm" onClick={() => setGroupFilter('all')}>
                Clear filter ({GROUP_META[groupFilter].label})
              </Button>
            )}
            <span className="text-sm text-muted-foreground">
              {loading ? 'Loading…' : `${filteredTables.length} table(s)`}
            </span>
          </div>

          {loading && !schema ? (
            <p className="text-sm text-muted-foreground">Loading schema…</p>
          ) : (
            <div className="space-y-3">
              {filteredTables.map((table) => {
                const isOpen = expanded.has(table.name);
                const gm = GROUP_META[table.group];
                return (
                  <Card key={table.name} id={`schema-table-${table.name}`} className="overflow-hidden scroll-mt-4">
                    <button
                      type="button"
                      onClick={() => toggleTable(table.name)}
                      className="w-full flex flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-mono text-sm font-semibold">{table.name}</span>
                      {table.entity && (
                        <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                          ({table.entity})
                        </span>
                      )}
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${gm.color}`}>{gm.label}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {table.columns.length} cols
                      </Badge>
                      {table.references.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          → {table.references.length} ref
                        </Badge>
                      )}
                      {table.referencedBy.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          ← {table.referencedBy.length} ref
                        </Badge>
                      )}
                    </button>

                    {isOpen && (
                      <CardContent className="pt-0 pb-5 px-4 space-y-5">
                        <p className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3">{table.purpose}</p>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-md border bg-muted/20 p-3">
                            <p className="text-xs font-semibold text-foreground mb-2">
                              References → (this table points to)
                            </p>
                            <RelationList
                              relations={table.references}
                              direction="out"
                              onTableClick={jumpToTable}
                            />
                          </div>
                          <div className="rounded-md border bg-muted/20 p-3">
                            <p className="text-xs font-semibold text-foreground mb-2">
                              Referenced by ← (other tables point here)
                            </p>
                            <RelationList
                              relations={table.referencedBy}
                              direction="in"
                              onTableClick={jumpToTable}
                            />
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-foreground mb-2">Columns</p>
                          <div className="overflow-x-auto rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Column</TableHead>
                                  <TableHead className="min-w-[200px]">Description</TableHead>
                                  <TableHead>Keys</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Null</TableHead>
                                  <TableHead>Relation</TableHead>
                                  <TableHead className="min-w-[100px]">Default</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {table.columns.map((col) => (
                                  <TableRow key={col.name}>
                                    <TableCell className="font-mono text-xs font-medium align-top">
                                      {col.name}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground align-top max-w-xs">
                                      {col.description}
                                    </TableCell>
                                    <TableCell className="align-top">
                                      <div className="flex flex-wrap gap-1">
                                        {col.isPrimaryKey && (
                                          <Badge className="text-[9px] px-1 py-0 h-4 bg-amber-500/90">PK</Badge>
                                        )}
                                        {col.isForeignKey && (
                                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                            FK
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground align-top">
                                      {formatColumnType(col)}
                                    </TableCell>
                                    <TableCell className="text-xs align-top">{col.nullable ? 'yes' : 'no'}</TableCell>
                                    <TableCell className="font-mono text-[10px] text-muted-foreground align-top">
                                      {col.referencesTable ? (
                                        <button
                                          type="button"
                                          onClick={() => jumpToTable(col.referencesTable!)}
                                          className="text-primary hover:underline"
                                        >
                                          → {col.referencesTable}.{col.referencesColumn}
                                        </button>
                                      ) : (
                                        '—'
                                      )}
                                    </TableCell>
                                    <TableCell className="font-mono text-[10px] text-muted-foreground max-w-[160px] truncate align-top">
                                      {col.default ?? '—'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
