'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MachineProfile {
  id: string;
  machineName: string;
  manufacturer: string | null;
  family: string | null;
  modelNumber: string | null;
  components: string | null;
  updatedAt: string;
}

export default function MachineProfilesPage() {
  const [rows, setRows] = useState<MachineProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMfr, setNewMfr] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<MachineProfile[]>('/machine-profiles');
      setRows(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createProfile = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('Machine name is required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/machine-profiles', {
        machineName: name,
        manufacturer: newMfr.trim() || undefined,
      });
      toast.success('Profile created');
      setNewName('');
      setNewMfr('');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Machine profiles" showSidebar={true}>
        <div className="space-y-6 max-w-5xl">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Machine profiles</h2>
            <p className="text-sm text-muted-foreground mt-1">
              List profiles; admins can add a row when auto-detection missed a machine.
            </p>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Add profile</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
              <div className="space-y-1.5 flex-1 min-w-[180px]">
                <Label htmlFor="mp-name">Machine name</Label>
                <Input
                  id="mp-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Danao"
                />
              </div>
              <div className="space-y-1.5 flex-1 min-w-[180px]">
                <Label htmlFor="mp-mfr">Manufacturer (optional)</Label>
                <Input
                  id="mp-mfr"
                  value={newMfr}
                  onChange={(e) => setNewMfr(e.target.value)}
                  placeholder="e.g. Delice"
                />
              </div>
              <Button onClick={createProfile} disabled={creating}>
                {creating ? 'Saving…' : 'Create'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">All profiles</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No machine profiles yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Machine</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Family</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.machineName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.manufacturer || '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.family || '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.modelNumber || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.updatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/admin/machine-profiles/${r.id}`}>Manage</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
