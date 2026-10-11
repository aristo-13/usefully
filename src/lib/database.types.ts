// Mirrors supabase/migrations. Regenerate with:
//   npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13'
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_items: {
        Row: {
          ai_generated: boolean
          author_id: string | null
          body: string
          canonical_url: string | null
          category_id: string | null
          click_count: number
          cover_media_id: string | null
          created_at: string
          difficulty: string | null
          excerpt: string
          external_url: string | null
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          keywords: string[]
          noindex: boolean
          published_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          search_vector: unknown
          seo_description: string | null
          seo_title: string | null
          slug: string
          sources: Json
          status: string
          title: string
          type: string
          updated_at: string
          version: string | null
        }
        Insert: {
          ai_generated?: boolean
          author_id?: string | null
          body?: string
          canonical_url?: string | null
          category_id?: string | null
          click_count?: number
          cover_media_id?: string | null
          created_at?: string
          difficulty?: string | null
          excerpt?: string
          external_url?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          keywords?: string[]
          noindex?: boolean
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sources?: Json
          status?: string
          title: string
          type: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          ai_generated?: boolean
          author_id?: string | null
          body?: string
          canonical_url?: string | null
          category_id?: string | null
          click_count?: number
          cover_media_id?: string | null
          created_at?: string
          difficulty?: string | null
          excerpt?: string
          external_url?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          keywords?: string[]
          noindex?: boolean
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sources?: Json
          status?: string
          title?: string
          type?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'content_items_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_items_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_items_cover_media_id_fkey'
            columns: ['cover_media_id']
            isOneToOne: false
            referencedRelation: 'media'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_items_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      content_tags: {
        Row: {
          content_id: string
          tag_id: string
        }
        Insert: {
          content_id: string
          tag_id: string
        }
        Update: {
          content_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'content_tags_content_id_fkey'
            columns: ['content_id']
            isOneToOne: false
            referencedRelation: 'content_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_tags_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
        ]
      }
      media: {
        Row: {
          alt_text: string
          created_at: string
          file_name: string
          height: number | null
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string
          created_at?: string
          file_name: string
          height?: number | null
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string
          created_at?: string
          file_name?: string
          height?: number | null
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'media_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          bio: string
          created_at: string
          display_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          bio?: string
          created_at?: string
          display_name?: string
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          bio?: string
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      redirects: {
        Row: {
          click_count: number
          created_at: string
          destination_url: string
          id: string
          is_active: boolean
          notes: string
          slug: string
          updated_at: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          destination_url: string
          id?: string
          is_active?: boolean
          notes?: string
          slug: string
          updated_at?: string
        }
        Update: {
          click_count?: number
          created_at?: string
          destination_url?: string
          id?: string
          is_active?: boolean
          notes?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      category_counts: {
        Args: never
        Returns: {
          category_id: string
          item_count: number
        }[]
      }
      content_status_counts: {
        Args: never
        Returns: {
          item_count: number
          status: string
          type: string
        }[]
      }
      resolve_go_link: {
        Args: { link_slug: string }
        Returns: {
          link_file_name: string | null
          link_kind: string
          link_target: string
        }[]
      }
      search_content: {
        Args: {
          content_type?: string | null
          result_limit?: number
          search_query: string
        }
        Returns: {
          category_name: string | null
          category_slug: string | null
          excerpt: string
          id: string
          published_at: string
          rank: number
          slug: string
          title: string
          type: string
          updated_at: string
        }[]
      }
      tag_counts: {
        Args: never
        Returns: {
          item_count: number
          tag_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']
