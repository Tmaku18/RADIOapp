'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  display_name: string | null;
  role: 'listener' | 'artist' | 'admin';
  created_at: string;
}

type SortField = 'name' | 'email' | 'role' | 'created_at';
type SortOrder = 'asc' | 'desc';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<'all' | 'listener' | 'artist' | 'admin'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lifetimeBanUser, setLifetimeBanUser] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('');
  const [deleteAccountUser, setDeleteAccountUser] = useState<User | null>(null);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadUsers();
  }, [filter, debouncedSearch, sortBy, sortOrder]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getUsers({
        role: filter,
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
        limit: 100,
      });
      setUsers(response.data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-primary ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleRoleChange = async (userId: string, newRole: 'listener' | 'artist' | 'admin') => {
    setActionLoading(userId);
    try {
      await adminApi.updateUserRole(userId, newRole);
      setUsers(users.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ));
      toast.success('Role updated');
    } catch (err) {
      console.error('Failed to update role:', err);
      toast.error('Failed to update role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLifetimeBan = async () => {
    if (!lifetimeBanUser) return;
    setActionLoading(lifetimeBanUser.id);
    try {
      await adminApi.lifetimeBanUser(lifetimeBanUser.id, banReason || 'Lifetime ban by admin');
      setUsers(users.filter(u => u.id !== lifetimeBanUser.id));
      setLifetimeBanUser(null);
      setBanReason('');
      toast.success('Account deactivated and banned');
    } catch (err) {
      console.error('Failed to lifetime ban:', err);
      toast.error('Failed to deactivate account');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountUser) return;
    setActionLoading(deleteAccountUser.id);
    try {
      await adminApi.deleteUserAccount(deleteAccountUser.id);
      setUsers(users.filter(u => u.id !== deleteAccountUser.id));
      setDeleteAccountUser(null);
      toast.success('Account deleted');
    } catch (err) {
      console.error('Failed to delete account:', err);
      toast.error('Failed to delete account');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'listener', 'artist', 'admin'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setFilter(role)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                filter === role
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {role === 'all' ? 'All Users' : role === 'listener' ? 'Prospectors' : `${role.charAt(0).toUpperCase()}${role.slice(1)}s`}
            </button>
          ))}
        </div>
        
        <div className="flex gap-3 items-center">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary w-64"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {/* Sort Dropdown */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-') as [SortField, SortOrder];
              setSortBy(field);
              setSortOrder(order);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="email-asc">Email A-Z</option>
            <option value="email-desc">Email Z-A</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No users found with role: {filter === 'listener' ? 'Prospectors' : filter}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="text-left px-6 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-primary"
                  onClick={() => handleSort('name')}
                >
                  User <SortIcon field="name" />
                </th>
                <th 
                  className="text-left px-6 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-primary"
                  onClick={() => handleSort('email')}
                >
                  Email <SortIcon field="email" />
                </th>
                <th 
                  className="text-left px-6 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-primary"
                  onClick={() => handleSort('role')}
                >
                  Role <SortIcon field="role" />
                </th>
                <th 
                  className="text-left px-6 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-primary"
                  onClick={() => handleSort('created_at')}
                >
                  Joined <SortIcon field="created_at" />
                </th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mr-3">
                        <span className="text-primary font-medium">
                          {(user.display_name || user.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {user.display_name || 'No name'}
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                      user.role === 'admin' ? 'bg-primary/10 text-primary' :
                      user.role === 'artist' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role === 'listener' ? 'Prospector' : user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoading === user.id}
                          className="text-foreground bg-background"
                        >
                          {actionLoading === user.id ? '...' : `${user.role === 'listener' ? 'Prospector' : user.role} ▼`}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[160px] text-foreground [&_*]:text-foreground">
                        <DropdownMenuItem
                          onClick={() => handleRoleChange(user.id, 'listener')}
                          className="text-foreground focus:text-foreground focus:bg-accent cursor-pointer"
                        >
                          Set as Prospector
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRoleChange(user.id, 'artist')}
                          className="text-foreground focus:text-foreground focus:bg-accent cursor-pointer"
                        >
                          Set as Artist
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRoleChange(user.id, 'admin')}
                          className="text-foreground focus:text-foreground focus:bg-accent cursor-pointer"
                        >
                          Set as Admin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => { setLifetimeBanUser(user); setBanReason(''); }}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                        >
                          Lifetime Ban / Deactivate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteAccountUser(user)}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                        >
                          Delete Account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AlertDialog open={!!lifetimeBanUser} onOpenChange={(open) => !open && setLifetimeBanUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lifetime Ban / Deactivate Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently deactivate {lifetimeBanUser?.display_name || lifetimeBanUser?.email}&apos;s account.
              All their ores will be deleted from the database and storage. The user record will be kept so they cannot create a new account.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label htmlFor="ban-reason" className="block text-sm font-medium text-foreground mb-1">Reason (optional)</label>
            <input
              id="ban-reason"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="e.g. Terms of service violation"
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => handleLifetimeBan()}
            >
              Deactivate & Ban
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteAccountUser} onOpenChange={(open) => !open && setDeleteAccountUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteAccountUser?.display_name || deleteAccountUser?.email}&apos;s account and all associated data.
              Login credentials will be removed, so the user can sign up again if desired. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => handleDeleteAccount()}
            >
              Delete Account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
