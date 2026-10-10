# Storage Plan

This document outlines the planned structure for Supabase Storage to handle media uploads.

## Storage Buckets

### 1. `public-media`
A public bucket intended for all general media used across the website that needs to be publicly accessible without authentication.

**Folder Structure:**
- `/articles` - Cover images and inline content images for blog articles.
- `/tutorials` - Cover images and inline content images for tutorials.
- `/resources` - Icons and thumbnails for external resources.
- `/downloads` - Icons and preview images for downloadable content.
- `/avatars` - User profile pictures.
- `/general` - Site-wide assets like logos or placeholder images managed from the CMS.

**Access Policies:**
- `SELECT`: Public access (everyone can read).
- `INSERT/UPDATE/DELETE`: Restricted to authenticated users with 'admin' roles (or the specific user for their own avatar).

### 2. `secure-downloads` (Optional for future)
A private bucket for downloadable files that require authentication, payment, or specific permissions to access.

**Folder Structure:**
- `/{category-slug}` - Organized by category.

**Access Policies:**
- `SELECT`: Restricted based on application logic (e.g., authenticated users or users who have purchased).
- `INSERT/UPDATE/DELETE`: Restricted to admin users.

## Security & Best Practices
- The CMS will generate UUID-based filenames to prevent collisions and predictable URLs.
- Image formats will preferably be converted/optimized (e.g., WebP) before or upon upload.
- File size limits will be enforced at the bucket level (e.g., 5MB for images).
