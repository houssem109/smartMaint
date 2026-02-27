'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

const CATEGORY_OPTIONS = [
  { value: 'software', label: 'Software Problem', subcategories: [
    { value: 'windows_update', label: 'Windows Update' },
    { value: 'bsod', label: 'BSOD (Blue Screen)' },
    { value: 'software_crash', label: 'Software Crash' },
    { value: 'app_error', label: 'Application Error' },
    { value: 'network', label: 'Network/Connectivity' },
    { value: 'other', label: 'Other' },
  ]},
  { value: 'hardware', label: 'Hardware', subcategories: [
    { value: 'machine_part', label: 'Machine Part' },
    { value: 'motor', label: 'Motor' },
    { value: 'sensor', label: 'Sensor' },
    { value: 'conveyor', label: 'Conveyor' },
    { value: 'electrical_component', label: 'Electrical Component' },
    { value: 'other', label: 'Other' },
  ]},
  { value: 'mechanical', label: 'Mechanical', subcategories: [
    { value: 'bearing', label: 'Bearing' },
    { value: 'belt', label: 'Belt' },
    { value: 'gear', label: 'Gear' },
    { value: 'pump', label: 'Pump' },
    { value: 'other', label: 'Other' },
  ]},
  { value: 'electrical', label: 'Electrical', subcategories: [
    { value: 'wiring', label: 'Wiring' },
    { value: 'circuit_breaker', label: 'Circuit Breaker' },
    { value: 'motor', label: 'Motor' },
    { value: 'switch', label: 'Switch' },
    { value: 'other', label: 'Other' },
  ]},
  { value: 'plumbing', label: 'Plumbing', subcategories: [
    { value: 'pipe', label: 'Pipe' },
    { value: 'valve', label: 'Valve' },
    { value: 'pump', label: 'Pump' },
    { value: 'drain', label: 'Drain' },
    { value: 'other', label: 'Other' },
  ]},
  { value: 'task', label: 'Task', subcategories: [
    { value: 'change_database_value', label: 'Change Value in Database' },
    { value: 'remove_data', label: 'Remove Something' },
    { value: 'update_code', label: 'Update Code' },
    { value: 'fix_bug', label: 'Fix Bug' },
    { value: 'add_feature', label: 'Add Feature' },
    { value: 'refactor_code', label: 'Refactor Code' },
    { value: 'database_migration', label: 'Database Migration' },
    { value: 'other', label: 'Other' },
  ]},
  { value: 'other', label: 'Other', subcategories: [] },
];

function getDashboardPath(role: string) {
  const r = role?.toLowerCase?.();
  if (r === 'admin' || r === 'superadmin') return '/dashboard/admin';
  if (r === 'technician') return '/dashboard/technician';
  return '/dashboard/worker';
}

export default function CreateTicketPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'software',
    subcategory: '',
    priority: 'medium',
    machine: '',
    area: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentCategory = CATEGORY_OPTIONS.find((c) => c.value === formData.category);
  const hasSubcategories = currentCategory && currentCategory.subcategories.length > 0;
  const showMachineField = ['hardware', 'mechanical', 'electrical', 'plumbing'].includes(formData.category);
  const showAreaField = true;

  const handleCategoryChange = (category: string) => {
    setFormData({ ...formData, category, subcategory: '' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    setFiles((prev) => {
      const existing = prev || [];
      // Avoid duplicates by simple name+size key
      const existingKeys = new Set(existing.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const merged = [
        ...existing,
        ...selected.filter((f) => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`)),
      ];
      return merged;
    });
    // Allow selecting the same file again if removed later
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const toastId = toast.loading('Creating ticket...');
    try {
      // First create the ticket
      const createRes = await api.post('/tickets', formData);
      const ticket = createRes.data;

      // If files are selected, upload them as attachments (optional)
      if (files.length > 0 && ticket?.id) {
        const formDataFiles = new FormData();
        files.forEach((file) => {
          formDataFiles.append('files', file);
        });
        await api.post(`/tickets/${ticket.id}/attachments`, formDataFiles, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success('Ticket created successfully!', { id: toastId });
      setTimeout(() => {
        router.push(getDashboardPath(user?.role || 'worker'));
      }, 1000);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to create ticket';
      setError(errorMessage);
      toast.error(errorMessage, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const showSidebar =
    user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'technician';

  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin', 'technician', 'worker']}>
      <Layout title="Create New Ticket" showSidebar={showSidebar}>
        <div className="max-w-2xl mx-auto">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Create Maintenance Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Brief description of the issue"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    required
                    rows={5}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detailed description of the problem..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {hasSubcategories && (
                  <div className="space-y-2">
                    <Label htmlFor="subcategory">Type / Subcategory *</Label>
                    <Select
                      id="subcategory"
                      required
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    >
                      <option value="">Select type...</option>
                      {currentCategory?.subcategories.map((sub) => (
                        <option key={sub.value} value={sub.value}>
                          {sub.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      id="priority"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </Select>
                  </div>

                  {showAreaField && (
                    <div className="space-y-2">
                      <Label htmlFor="area">Area/Location</Label>
                      <Input
                        id="area"
                        type="text"
                        value={formData.area}
                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                        placeholder="e.g., Production Line 1"
                      />
                    </div>
                  )}
                </div>

                {showMachineField && (
                  <div className="space-y-2">
                    <Label htmlFor="machine">Machine/Equipment</Label>
                    <Input
                      id="machine"
                      type="text"
                      value={formData.machine}
                      onChange={(e) => setFormData({ ...formData, machine: e.target.value })}
                      placeholder="e.g., Machine A, Conveyor B2"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Attachments (optional)</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      + Add files
                    </Button>
                    {files.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {files.length} file{files.length > 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    id="attachments"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {files.length > 0 && (
                    <ul className="mt-2 space-y-1 rounded-md border border-dashed border-border/70 bg-muted/40 px-3 py-2 text-xs">
                      {files.map((file, idx) => (
                        <li key={`${file.name}-${file.size}-${idx}`} className="truncate">
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    You can attach screenshots, photos, or documents to help describe the issue.
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                    size="lg"
                  >
                    {loading ? 'Creating...' : 'Create Ticket'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
