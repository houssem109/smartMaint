'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface MachineProfile {
  id: string;
  machineName: string;
  manufacturer: string | null;
  family: string | null;
  modelNumber: string | null;
  components: string | null;
  updatedAt: string;
}

interface Summary {
  profile: MachineProfile;
  pdfDocumentCount: number;
  knowledgeEntriesApproxCount: number;
  knowledgeEntriesWithPhotoApproxCount: number;
}

export default function MachineProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    machineName: '',
    manufacturer: '',
    family: '',
    modelNumber: '',
    components: '',
  });

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<Summary>(`/machine-profiles/${id}/summary`);
      setSummary(res.data);
      const p = res.data.profile;
      setForm({
        machineName: p.machineName,
        manufacturer: p.manufacturer ?? '',
        family: p.family ?? '',
        modelNumber: p.modelNumber ?? '',
        components: p.components ?? '',
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    if (!id) return;
    const name = form.machineName.trim();
    if (!name) {
      toast.error('Machine name is required');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/machine-profiles/${id}`, {
        machineName: name,
        manufacturer: form.manufacturer.trim() || null,
        family: form.family.trim() || null,
        modelNumber: form.modelNumber.trim() || null,
        components: form.components.trim() || null,
      });
      toast.success('Profile updated');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Machine profile" showSidebar={true}>
        <div className="space-y-6 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/admin/machine-profiles">← All profiles</Link>
            </Button>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!loading && summary && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Linked content (approximate)</CardTitle>
                  <CardDescription>
                    PDFs use <code className="text-xs">machineProfileId</code>. Knowledge rows match{' '}
                    <strong>machine name</strong> text only (not a foreign key).
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">PDFs linked</span>
                    <div className="text-2xl font-semibold tabular-nums">{summary.pdfDocumentCount}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Knowledge rows (name match)</span>
                    <div className="text-2xl font-semibold tabular-nums">
                      {summary.knowledgeEntriesApproxCount}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Field photos (name match)</span>
                    <div className="text-2xl font-semibold tabular-nums">
                      {summary.knowledgeEntriesWithPhotoApproxCount}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Edit profile</CardTitle>
                  <CardDescription>
                    <code className="text-xs">PATCH /machine-profiles/:id</code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Machine name</Label>
                    <Input
                      id="name"
                      value={form.machineName}
                      onChange={(e) => setForm((f) => ({ ...f, machineName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mfr">Manufacturer</Label>
                    <Input
                      id="mfr"
                      value={form.manufacturer}
                      onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fam">Family</Label>
                    <Input
                      id="fam"
                      value={form.family}
                      onChange={(e) => setForm((f) => ({ ...f, family: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="model">Model number</Label>
                    <Input
                      id="model"
                      value={form.modelNumber}
                      onChange={(e) => setForm((f) => ({ ...f, modelNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="comp">Components</Label>
                    <Input
                      id="comp"
                      value={form.components}
                      onChange={(e) => setForm((f) => ({ ...f, components: e.target.value }))}
                      placeholder="Comma-separated or free text"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => void save()} disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                    <Button variant="outline" type="button" onClick={() => router.push('/dashboard/admin/knowledge')}>
                      Open knowledge base
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(summary.profile.updatedAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
