'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import Link from 'next/link';

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  fullName: string;
  isActive: boolean;
}

export default function AdminDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // Refresh data every 5 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [ticketsRes, usersRes] = await Promise.all([
        api.get('/tickets'),
        api.get('/users'),
      ]);
      setTickets(ticketsRes.data);
      setUsers(usersRes.data);
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      toast.error(error.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalTickets: tickets.length,
    openTickets: tickets.filter((t) => t.status === 'open').length,
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.isActive).length,
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Layout title="Admin Dashboard">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <div className="text-sm text-gray-600 dark:text-gray-400 font-semibold">Total Tickets</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalTickets}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <div className="text-sm text-gray-600 dark:text-gray-400 font-semibold">Open Tickets</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.openTickets}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <div className="text-sm text-gray-600 dark:text-gray-400 font-semibold">Total Users</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <div className="text-sm text-gray-600 dark:text-gray-400 font-semibold">Active Users</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.activeUsers}</div>
            </div>
          </div>

          {/* Recent Tickets */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Tickets</h3>
              <div className="flex space-x-2">
                <button
                  onClick={fetchData}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-semibold"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-900 dark:text-white font-semibold">Loading...</p>
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-900 dark:text-white font-semibold">No tickets yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.slice(0, 5).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{ticket.title}</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full font-semibold ${
                          ticket.status === 'open'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-gray-100 text-gray-900 dark:bg-gray-600 dark:text-gray-200'
                        }`}
                      >
                        {ticket.status}
                      </span>
                      <Link
                        href={`/dashboard/tickets/${ticket.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-semibold"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Users</h3>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-900 dark:text-white font-semibold">Loading...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 dark:text-white uppercase">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 dark:text-white uppercase">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 dark:text-white uppercase">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 dark:text-white uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {user.fullName || user.username}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-semibold">{user.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white capitalize font-semibold">
                          {user.role}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full font-semibold ${
                              user.isActive
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
