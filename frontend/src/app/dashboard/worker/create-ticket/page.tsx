'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';

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
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Create Maintenance Ticket</h2>

            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 px-4 py-3 rounded font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-semibold">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
                  placeholder="Brief description of the issue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-semibold">
                  Description *
                </label>
                <textarea
                  required
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
                  placeholder="Detailed description of the problem..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-semibold">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {hasSubcategories && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-semibold">
                    Type / Subcategory *
                  </label>
                  <select
                    required
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
                  >
                    <option value="">Select type...</option>
                    {currentCategory?.subcategories.map((sub) => (
                      <option key={sub.value} value={sub.value}>
                        {sub.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-semibold">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                {showAreaField && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-semibold">
                      Area/Location
                    </label>
                    <input
                      type="text"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
                      placeholder="e.g., Production Line 1"
                    />
                  </div>
                )}
              </div>

              {showMachineField && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 font-semibold">
                    Machine/Equipment
                  </label>
                  <input
                    type="text"
                    value={formData.machine}
                    onChange={(e) => setFormData({ ...formData, machine: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
                    placeholder="e.g., Machine A, Conveyor B2"
                  />
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 dark:bg-blue-700 text-white py-3 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 font-bold text-lg"
                >
                  {loading ? 'Creating...' : 'Create Ticket'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
