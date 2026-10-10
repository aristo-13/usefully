# Database Plan

This document outlines the intended future Supabase tables and their main relationships.

## Planned Tables

### 1. `profiles`
Extends the default Supabase `auth.users` table with additional user information.
- `id` (uuid, primary key, references `auth.users.id`)
- `role` (enum: 'admin', 'user')
- `full_name` (text)
- `avatar_url` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 2. `categories`
Groups content (articles, tutorials, resources, etc.) logically.
- `id` (uuid, primary key)
- `name` (text)
- `slug` (text, unique)
- `description` (text, nullable)
- `created_at` (timestamp)

### 3. `tags`
Provides fine-grained categorization for content.
- `id` (uuid, primary key)
- `name` (text)
- `slug` (text, unique)
- `created_at` (timestamp)

### 4. `articles`
Stores blog posts and editorial content.
- `id` (uuid, primary key)
- `title` (text)
- `slug` (text, unique)
- `content` (text/jsonb for TipTap)
- `excerpt` (text)
- `cover_image_url` (text, nullable)
- `author_id` (uuid, references `profiles.id`)
- `category_id` (uuid, references `categories.id`)
- `published_at` (timestamp, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 5. `tutorials`
Stores step-by-step guides and instructional content.
- `id` (uuid, primary key)
- `title` (text)
- `slug` (text, unique)
- `content` (text/jsonb)
- `difficulty` (enum: 'beginner', 'intermediate', 'advanced')
- `author_id` (uuid, references `profiles.id`)
- `category_id` (uuid, references `categories.id`)
- `published_at` (timestamp, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 6. `resources`
Stores useful external links and tools.
- `id` (uuid, primary key)
- `title` (text)
- `description` (text)
- `url` (text)
- `icon_url` (text, nullable)
- `category_id` (uuid, references `categories.id`)
- `created_at` (timestamp)

### 7. `downloads`
Stores downloadable assets or files.
- `id` (uuid, primary key)
- `title` (text)
- `description` (text)
- `file_url` (text)
- `icon_url` (text, nullable)
- `category_id` (uuid, references `categories.id`)
- `created_at` (timestamp)

### 8. `redirects`
Manages short links or platform redirects.
- `id` (uuid, primary key)
- `source_path` (text, unique)
- `destination_url` (text)
- `clicks` (integer, default 0)
- `created_at` (timestamp)

### 9. `media`
Tracks uploaded files within Supabase storage for the CMS.
- `id` (uuid, primary key)
- `file_name` (text)
- `file_path` (text)
- `content_type` (text)
- `size` (integer)
- `uploaded_by` (uuid, references `profiles.id`)
- `created_at` (timestamp)

## Relationships (Many-to-Many)

- **`article_tags`**: Links `articles` and `tags` (article_id, tag_id).
- **`tutorial_tags`**: Links `tutorials` and `tags` (tutorial_id, tag_id).
- **`resource_tags`**: Links `resources` and `tags` (resource_id, tag_id).
- **`download_tags`**: Links `downloads` and `tags` (download_id, tag_id).
