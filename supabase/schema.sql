-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_roles enum
CREATE TYPE user_role AS ENUM ('admin', 'central_store_manager', 'project_store_manager');

-- Create user_profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'project_store_manager',
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to automatically create user_profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'project_store_manager'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check if current user is admin (to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;

-- Users can see their own profile (this is critical and should be created first)
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can see all profiles (using function to avoid recursion)
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (public.is_admin());

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  USING (public.is_admin());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can insert profiles
CREATE POLICY "Admins can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (public.is_admin());

-- Create policies for projects
-- Admins can see all projects
CREATE POLICY "Admins can view all projects"
  ON projects FOR SELECT
  USING (public.is_admin());

-- Central store managers can see all projects
CREATE POLICY "Central store managers can view all projects"
  ON projects FOR SELECT
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'central_store_manager'
    )
  );

-- Project store managers can see their own project
CREATE POLICY "Project store managers can view own project"
  ON projects FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM user_profiles
      WHERE id = auth.uid() AND role = 'project_store_manager'
    )
  );

-- Admins can insert projects
CREATE POLICY "Admins can insert projects"
  ON projects FOR INSERT
  WITH CHECK (public.is_admin());

-- Admins can update projects
CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  USING (public.is_admin());

-- Admins can delete projects
CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  USING (public.is_admin());

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

