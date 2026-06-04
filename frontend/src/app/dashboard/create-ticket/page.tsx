'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  ArrowLeft,
  ClipboardList,
  Cpu,
  Droplets,
  FileText,
  ImageIcon,
  Loader2,
  MapPin,
  Monitor,
  Settings2,
  Upload,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  {
    value: 'software',
    label: 'Software',
    icon: Monitor,
    subcategories: [
      { value: 'windows_update', label: 'Windows Update' },
      { value: 'bsod', label: 'BSOD (Blue Screen)' },
      { value: 'software_crash', label: 'Software Crash' },
      { value: 'app_error', label: 'Application Error' },
      { value: 'network', label: 'Network/Connectivity' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    value: 'hardware',
    label: 'Hardware',
    icon: Cpu,
    subcategories: [
      { value: 'machine_part', label: 'Machine Part' },
      { value: 'motor', label: 'Motor' },
      { value: 'sensor', label: 'Sensor' },
      { value: 'conveyor', label: 'Conveyor' },
      { value: 'electrical_component', label: 'Electrical Component' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    value: 'mechanical',
    label: 'Mechanical',
    icon: Settings2,
    subcategories: [
      { value: 'bearing', label: 'Bearing' },
      { value: 'belt', label: 'Belt' },
      { value: 'gear', label: 'Gear' },
      { value: 'pump', label: 'Pump' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    value: 'electrical',
    label: 'Electrical',
    icon: Zap,
    subcategories: [
      { value: 'wiring', label: 'Wiring' },
      { value: 'circuit_breaker', label: 'Circuit Breaker' },
      { value: 'motor', label: 'Motor' },
      { value: 'switch', label: 'Switch' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    value: 'plumbing',
    label: 'Plumbing',
    icon: Droplets,
    subcategories: [
      { value: 'pipe', label: 'Pipe' },
      { value: 'valve', label: 'Valve' },
      { value: 'pump', label: 'Pump' },
      { value: 'drain', label: 'Drain' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    value: 'task',
    label: 'Task',
    icon: ClipboardList,
    subcategories: [
      { value: 'change_database_value', label: 'Change Value in Database' },
      { value: 'remove_data', label: 'Remove Something' },
      { value: 'update_code', label: 'Update Code' },
      { value: 'fix_bug', label: 'Fix Bug' },
      { value: 'add_feature', label: 'Add Feature' },
      { value: 'refactor_code', label: 'Refactor Code' },
      { value: 'database_migration', label: 'Database Migration' },
      { value: 'other', label: 'Other' },
    ],
  },
  { value: 'other', label: 'Other', icon: Wrench, subcategories: [] },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', description: 'Can wait', className: 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 data-[active=true]:border-slate-400 data-[active=true]:bg-slate-100 data-[active=true]:ring-2 data-[active=true]:ring-slate-300/50' },
  { value: 'medium', label: 'Medium', description: 'Normal', className: 'border-blue-200 bg-blue-50/80 text-blue-800 hover:border-blue-300 data-[active=true]:border-blue-400 data-[active=true]:bg-blue-100 data-[active=true]:ring-2 data-[active=true]:ring-blue-400/40' },
  { value: 'high', label: 'High', description: 'Soon', className: 'border-amber-200 bg-amber-50/80 text-amber-900 hover:border-amber-300 data-[active=true]:border-amber-400 data-[active=true]:bg-amber-100 data-[active=true]:ring-2 data-[active=true]:ring-amber-400/40' },
  { value: 'critical', label: 'Critical', description: 'Urgent', className: 'border-red-200 bg-red-50/80 text-red-800 hover:border-red-300 data-[active=true]:border-red-500 data-[active=true]:bg-red-100 data-[active=true]:ring-2 data-[active=true]:ring-red-400/50' },
];

function getDashboardPath(role: string) {
  const r = role?.toLowerCase?.();
  if (r === 'admin' || r === 'superadmin') return '/dashboard/admin';
  if (r === 'technician') return '/dashboard/technician';
  return '/dashboard/worker';
}

function getCancelPath(role: string) {
  const r = role?.toLowerCase?.();
  if (r === 'admin' || r === 'superadmin') return '/dashboard/admin/tickets';
  if (r === 'technician') return '/dashboard/technician/tickets';
  return '/dashboard/worker';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SectionHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {step}
      </div>
      <div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="mt-1">{description}</CardDescription>
      </div>
    </div>
  );
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
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentCategory = CATEGORY_OPTIONS.find((c) => c.value === formData.category);
  const hasSubcategories = currentCategory && currentCategory.subcategories.length > 0;
  const showMachineField = ['hardware', 'mechanical', 'electrical', 'plumbing'].includes(
    formData.category,
  );

  const handleCategoryChange = (category: string) => {
    setFormData({ ...formData, category, subcategory: '' });
  };

  const addFiles = (selected: File[]) => {
    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      return [
        ...prev,
        ...selected.filter((f) => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`)),
      ];
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const toastId = toast.loading('Creating ticket...');
    try {
      const createRes = await api.post('/tickets', formData);
      const ticket = createRes.data;

      if (files.length > 0 && ticket?.id) {
        const formDataFiles = new FormData();
        files.forEach((file) => formDataFiles.append('files', file));
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
        <div className="mx-auto mb-12 max-w-3xl space-y-6 pb-10">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Create maintenance ticket</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => router.push(getCancelPath(user?.role || 'worker'))}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1 — Issue */}
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-primary/60 to-accent/60" aria-hidden />
              <CardHeader>
                <SectionHeader
                  step={1}
                  title="What happened?"
                  description="Give a clear title and enough detail for the team to act."
                />
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Conveyor belt stopped on Line 2"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    required
                    rows={5}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What did you observe? When did it start? Any error codes or steps to reproduce?"
                    className="resize-y min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.description.length} characters
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Step 2 — Classification */}
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-primary/40 to-transparent" aria-hidden />
              <CardHeader>
                <SectionHeader
                  step={2}
                  title="Classification"
                  description="Choose category, type, and how urgent this is."
                />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Category</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {CATEGORY_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const active = formData.category === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleCategoryChange(opt.value)}
                          data-active={active}
                          className={cn(
                            'flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-center text-sm font-medium transition-all',
                            active
                              ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20 shadow-sm'
                              : 'border-border/70 bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/40 hover:text-foreground',
                          )}
                        >
                          <Icon className={cn('h-5 w-5', active && 'text-primary')} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {hasSubcategories && (
                  <div className="space-y-2 rounded-lg border border-dashed border-border/70 bg-muted/20 p-4">
                    <Label htmlFor="subcategory" className="text-sm font-medium">
                      Type / subcategory <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      id="subcategory"
                      required
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                      className="h-11 bg-card"
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

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Priority</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PRIORITY_OPTIONS.map((opt) => {
                      const active = formData.priority === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          data-active={active}
                          onClick={() => setFormData({ ...formData, priority: opt.value })}
                          className={cn(
                            'rounded-lg border px-3 py-3 text-left transition-all',
                            opt.className,
                          )}
                        >
                          <span className="block text-sm font-semibold">{opt.label}</span>
                          <span className="mt-0.5 block text-xs opacity-80">{opt.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3 — Location */}
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-accent/50 to-transparent" aria-hidden />
              <CardHeader>
                <SectionHeader
                  step={3}
                  title="Where?"
                  description="Help technicians find the right place on site."
                />
              </CardHeader>
              <CardContent>
                <div className={cn('grid gap-4', showMachineField ? 'sm:grid-cols-2' : 'grid-cols-1')}>
                  <div className="space-y-2">
                    <Label htmlFor="area" className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Area / location
                    </Label>
                    <Input
                      id="area"
                      type="text"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      placeholder="e.g. Production Line 1, Building B"
                      className="h-11"
                    />
                  </div>
                  {showMachineField && (
                    <div className="space-y-2">
                      <Label htmlFor="machine" className="flex items-center gap-2 text-sm font-medium">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        Machine / equipment
                      </Label>
                      <Input
                        id="machine"
                        type="text"
                        value={formData.machine}
                        onChange={(e) => setFormData({ ...formData, machine: e.target.value })}
                        placeholder="e.g. Machine A, Conveyor B2"
                        className="h-11"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Step 4 — Attachments */}
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-muted-foreground/20 to-transparent" aria-hidden />
              <CardHeader>
                <SectionHeader
                  step={4}
                  title="Attachments"
                  description="Photos, screenshots, or documents (optional)."
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors',
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-border/80 bg-muted/20 hover:border-primary/40 hover:bg-muted/30',
                  )}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      Drop files here or <span className="text-primary">browse</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Images, PDF, Word, Excel, or text — multiple files allowed
                    </p>
                  </div>
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
                  <ul className="space-y-2">
                    {files.map((file, idx) => {
                      const isImage = file.type.startsWith('image/');
                      return (
                        <li
                          key={`${file.name}-${file.size}-${idx}`}
                          className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-sm"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                            {isImage ? (
                              <ImageIcon className="h-4 w-4 text-primary" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFile(idx)}
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-4 pt-2">
              <Button type="submit" disabled={loading} className="flex-1" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create ticket'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(getCancelPath(user?.role || 'worker'))}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
