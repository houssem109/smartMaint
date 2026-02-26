'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

// Category suboptions - inputs change based on selected category
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

export default function CreateTicketPage() {
  const router = useRouter();
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

  const currentCategory = CATEGORY_OPTIONS.find((c) => c.value === formData.category);
  const hasSubcategories = currentCategory && currentCategory.subcategories.length > 0;
  const showMachineField = ['hardware', 'mechanical', 'electrical', 'plumbing'].includes(formData.category);
  const showAreaField = true; // Most categories benefit from location

  const handleCategoryChange = (category: string) => {
    setFormData({ ...formData, category, subcategory: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const toastId = toast.loading('Creating ticket...');
    try {
      await api.post('/tickets', formData);
      toast.success('Ticket created successfully!', { id: toastId });
      setTimeout(() => {
        router.push('/dashboard/worker');
      }, 1000);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to create ticket';
      setError(errorMessage);
      toast.error(errorMessage, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['worker']}>
      <Layout title="Create New Ticket">
        <div className="max-w-2xl mx-auto">
          <Card>
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

                <div className="flex space-x-4">
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
