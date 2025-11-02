# Inventory Management System

A construction company inventory management tool built with Next.js, Supabase, and Tailwind CSS.

## Features

- **Central Store Management**: Purchase items and issue them to project stores
- **Project Store Management**: Issue items to specific projects and track recipients
- **Role-Based Access Control**: 
  - Project Store Owners: Can only see their own store
  - Central Store Owners: Can see central store and project stores (without prices)
  - Admin/Account Team: Full access to all stores, prices, reports, and store creation

## Tech Stack

- **Frontend**: Next.js 16 with TypeScript
- **Database & Auth**: Supabase
- **Styling**: Tailwind CSS v4

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account and project

### Setup Instructions

1. **Install dependencies:**

```bash
npm install
```

2. **Set up Supabase:**

   - Create a new project at [Supabase](https://app.supabase.com)
   - Go to your project settings → API
   - Copy your project URL and anon/public key

3. **Configure environment variables:**

   Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Set up Supabase Database:**

   - In your Supabase dashboard, go to SQL Editor
   - Run the SQL script from `supabase/schema.sql` to create all necessary tables and policies
   - This will create:
     - `user_profiles` table for user roles and metadata
     - `projects` table for project management
     - Row Level Security (RLS) policies for role-based access

5. **Set up Supabase Authentication:**

   - In your Supabase dashboard, go to Authentication → Providers
   - Enable Email provider (enabled by default)
   - Create your first admin user:
     - Go to Authentication → Users
     - Click "Add user" → "Create new user"
     - Enter email and password for your admin account
     - After creating the user, go to SQL Editor and run:
       ```sql
       UPDATE user_profiles 
       SET role = 'admin' 
       WHERE email = 'your-admin-email@example.com';
       ```
     - This will set the user as an admin so they can access user and project management features
   
6. **Configure Service Role Key (for user creation):**

   - In your Supabase dashboard, go to Settings → API
   - Copy the `service_role` key (keep this secret!)
   - Add it to your `.env.local` file:
     ```
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     ```
     - This is required for admin users to create new users through the application

7. **Run the development server:**

```bash
npm run dev
```

8. **Open your browser:**

Navigate to [http://localhost:3000](http://localhost:3000). You will be redirected to the login page.

## Current Status

✅ **Completed:**
- Supabase authentication setup
- Login page with email/password authentication
- Basic admin dashboard (empty placeholder)
- Route protection middleware
- Logout functionality

✅ **Recently Completed:**
- User management with role-based access (Admin, Central Store Manager, Project Store Manager)
- Project management (create, list, delete projects)
- Database schema with Row Level Security
- Server actions for CRUD operations

🚧 **Coming Next:**
- Inventory items management
- Purchase orders
- Issue items functionality
- Store-specific inventory views based on roles

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
