-- Migration: Add ban-related columns to users table
-- Run this in Supabase SQL Editor or via CLI

-- Add hard ban columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES users(id);

-- Add shadow ban columns (for chat trolls)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_shadow_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS shadow_banned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS shadow_ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS shadow_banned_by UUID REFERENCES users(id);

-- Index for quickly filtering banned users
CREATE INDEX IF NOT EXISTS idx_users_banned ON users(is_banned) WHERE is_banned = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_shadow_banned ON users(is_shadow_banned) WHERE is_shadow_banned = TRUE;

-- Add soft delete column for chat messages (for when banning deletes data)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted ON chat_messages(deleted_at) WHERE deleted_at IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN users.is_banned IS 'Hard ban - user fully locked out, tokens revoked';
COMMENT ON COLUMN users.is_shadow_banned IS 'Shadow ban - user thinks active but messages invisible to others';
COMMENT ON COLUMN users.ban_reason IS 'Reason for hard ban (visible to admins)';
COMMENT ON COLUMN users.shadow_ban_reason IS 'Reason for shadow ban (visible to admins)';
