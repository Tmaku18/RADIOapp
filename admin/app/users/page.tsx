'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../lib/api';
import type { User } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type RoleFilter = 'all' | 'listener' | 'artist' | 'admin';

export default function UsersPage() {
  const { getIdToken } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Fetch users with optional role filter
      const filters: { role?: string; limit?: number } = { limit: 100 };
      if (roleFilter !== 'all') {
        filters.role = roleFilter;
      }

      const data = await adminApi.getUsers(token, filters);
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [getIdToken, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = roleFilter === 'all' 
    ? users 
    : users.filter(user => user.role === roleFilter);

  const handleUpdateRole = async (userId: string, newRole: 'listener' | 'artist' | 'admin') => {
    try {
      const token = await getIdToken();
      if (!token) return;

      await adminApi.updateUserRole(token, userId, newRole);
      
      // Update local state
      setUsers(users => 
        users.map(user => 
          user.id === userId ? { ...user, role: newRole, updated_at: new Date().toISOString() } : user
        )
      );
      setEditingUser(null);
    } catch (err) {
      console.error('Failed to update user role:', err);
      alert('Failed to update user role. Please try again.');
    }
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      listener: 'bg-blue-100 text-blue-800',
      artist: 'bg-purple-100 text-purple-800',
      admin: 'bg-red-100 text-red-800',
    };
    return styles[role as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const getRoleIcon = (role: string) => {
    const icons = {
      listener: '🎧',
      artist: '🎤',
      admin: '👑',
    };
    return icons[role as keyof typeof icons] || '👤';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load users</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadUsers}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500">Manage user accounts and roles</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={loadUsers}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            🔄 Refresh
          </button>
          <div className="flex space-x-2">
            {(['all', 'listener', 'artist', 'admin'] as RoleFilter[]).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  roleFilter === role
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
                {role !== 'all' && (
                  <span className="ml-2 text-xs">
                    ({users.filter(u => u.role === role).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Total Users</div>
          <div className="text-2xl font-bold text-gray-900">{users.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Listeners</div>
          <div className="text-2xl font-bold text-blue-600">
            {users.filter(u => u.role === 'listener').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Artists</div>
          <div className="text-2xl font-bold text-purple-600">
            {users.filter(u => u.role === 'artist').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Admins</div>
          <div className="text-2xl font-bold text-red-600">
            {users.filter(u => u.role === 'admin').length}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.display_name || 'User'}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <span>{getRoleIcon(user.role)}</span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.display_name || 'No name'}
                        </div>
                        <div className="text-xs text-gray-500">ID: {user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUser === user.id ? (
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value as 'listener' | 'artist' | 'admin')}
                        onBlur={() => setEditingUser(null)}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        autoFocus
                      >
                        <option value="listener">Listener</option>
                        <option value="artist">Artist</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(user.role)}`}>
                        {getRoleIcon(user.role)} {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setEditingUser(editingUser === user.id ? null : user.id)}
                      className="text-purple-600 hover:text-purple-900"
                    >
                      {editingUser === user.id ? 'Cancel' : 'Change Role'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
