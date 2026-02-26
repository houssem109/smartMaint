'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import ConfirmModal from '@/components/ConfirmModal';
import { UserPlus, Pencil, Trash2, X } from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  role: string;
  isActive: boolean;
}

const ROLES_BY_CURRENT: Record<string, { value: string; label: string }[]> = {
  // Superadmin can manage admins/technicians/workers, but cannot create more superadmins
  superadmin: [
    { value: 'admin', label: 'Admin' },
    { value: 'technician', label: 'Technician' },
    { value: 'worker', label: 'Worker' },
  ],
  // Normal admin cannot create or edit admin/superadmin users -> hide those roles in the form
  admin: [
    { value: 'technician', label: 'Technician' },
    { value: 'worker', label: 'Worker' },
  ],
};

const emptyForm = {
  username: '',
  email: '',
  password: '',
  fullName: '',
  phoneNumber: '',
  role: 'worker',
};

export default function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const roles = ROLES_BY_CURRENT[currentUser?.role === 'superadmin' ? 'superadmin' : 'admin'] ?? ROLES_BY_CURRENT.admin;
  const canEditDeleteAdminRoles = currentUser?.role === 'superadmin';
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingId(user.id);
    setForm({
      username: user.username,
      email: user.email,
      password: '',
      fullName: user.fullName || '',
      phoneNumber: user.phoneNumber || '',
      role: user.role,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        const payload: Record<string, string> = {
          username: form.username,
          email: form.email,
          fullName: form.fullName,
          phoneNumber: form.phoneNumber,
          role: form.role,
        };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editingId}`, payload);
        toast.success('User updated');
      } else {
        if (!form.password) {
          toast.error('Password is required for new users');
          setSaving(false);
          return;
        }
        await api.post('/users', {
          username: form.username,
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          phoneNumber: form.phoneNumber || undefined,
          role: form.role,
        });
        toast.success('User created. If email is configured, a welcome email was sent.');
      }
      closeModal();
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.message || (Array.isArray(err.response?.data?.message) ? err.response.data.message.join(', ') : 'Request failed');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success('User deleted');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Users" showSidebar={true}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight">All Users</h2>
            <Button onClick={openCreate} className="gap-2 w-fit">
              <UserPlus className="h-4 w-4" />
              Create new user
            </Button>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Users list</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Loading…
                </div>
              ) : users.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No users yet. Create one to get started.
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Full name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} className="transition-colors">
                          <TableCell className="font-medium">
                            {user.fullName || '—'}
                          </TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.email}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.phoneNumber || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? 'default' : 'destructive'}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {(canEditDeleteAdminRoles || (user.role !== 'admin' && user.role !== 'superadmin')) &&
                                // Superadmin should not see edit/delete for their own superadmin account
                                !(currentUser?.id === user.id && user.role === 'superadmin') && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEdit(user)}
                                      title="Edit"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setDeleteTarget(user)}
                                      title="Delete"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create / Edit modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-md shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>
                  {editingId ? 'Edit user' : 'Create new user'}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={closeModal}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, fullName: e.target.value }))
                      }
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={form.username}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, username: e.target.value }))
                      }
                      placeholder="john.doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="john@smartmaint.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Mobile phone</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={form.phoneNumber}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phoneNumber: e.target.value }))
                      }
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Password {editingId && '(leave empty to keep current)'}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                      }
                      placeholder="••••••••"
                      required={!editingId}
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      id="role"
                      value={form.role}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, role: e.target.value }))
                      }
                    >
                      {roles.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={closeModal}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        <ConfirmModal
          isOpen={!!deleteTarget}
          title="Delete user"
          message={
            deleteTarget
              ? `Are you sure you want to delete "${deleteTarget.fullName || deleteTarget.username}"? This cannot be undone.`
              : ''
          }
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </Layout>
    </ProtectedRoute>
  );
}
