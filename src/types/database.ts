export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          invited_by?: string | null
          role: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          contact_email: string
          default_warranty_terms: string
          free_delivery_message: string
          id: number
          low_stock_threshold: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contact_email?: string
          default_warranty_terms?: string
          free_delivery_message?: string
          id?: number
          low_stock_threshold?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contact_email?: string
          default_warranty_terms?: string
          free_delivery_message?: string
          id?: number
          low_stock_threshold?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_report_items: {
        Row: {
          area: string
          created_at: string
          description: string
          id: string
          image_id: string | null
          report_id: string
          severity: Database["public"]["Enums"]["condition_severity"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          area: string
          created_at?: string
          description: string
          id?: string
          image_id?: string | null
          report_id: string
          severity: Database["public"]["Enums"]["condition_severity"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          description?: string
          id?: string
          image_id?: string | null
          report_id?: string
          severity?: Database["public"]["Enums"]["condition_severity"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condition_report_items_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "product_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condition_report_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "condition_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_reports: {
        Row: {
          created_at: string
          grade: Database["public"]["Enums"]["product_grade"] | null
          id: string
          product_id: string
          published_at: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade?: Database["public"]["Enums"]["product_grade"] | null
          id?: string
          product_id: string
          published_at?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade?: Database["public"]["Enums"]["product_grade"] | null
          id?: string
          product_id?: string
          published_at?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condition_reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "condition_reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          first_order_at: string | null
          id: string
          last_name: string | null
          last_order_at: string | null
          marketing_consent: boolean
          marketing_consent_at: string | null
          phone: string | null
          total_orders: number
          total_spent_pence: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          first_order_at?: string | null
          id?: string
          last_name?: string | null
          last_order_at?: string | null
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          phone?: string | null
          total_orders?: number
          total_spent_pence?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          first_order_at?: string | null
          id?: string
          last_name?: string | null
          last_order_at?: string | null
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          phone?: string | null
          total_orders?: number
          total_spent_pence?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total_pence: number
          order_id: string
          product_brand: string | null
          product_condition: Database["public"]["Enums"]["product_condition"]
          product_grade: Database["public"]["Enums"]["product_grade"] | null
          product_hero_url: string | null
          product_id: string | null
          product_name: string
          product_sku: string
          product_slug: string
          quantity: number
          unit_price_pence: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_pence: number
          order_id: string
          product_brand?: string | null
          product_condition: Database["public"]["Enums"]["product_condition"]
          product_grade?: Database["public"]["Enums"]["product_grade"] | null
          product_hero_url?: string | null
          product_id?: string | null
          product_name: string
          product_sku: string
          product_slug: string
          quantity: number
          unit_price_pence: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total_pence?: number
          order_id?: string
          product_brand?: string | null
          product_condition?: Database["public"]["Enums"]["product_condition"]
          product_grade?: Database["public"]["Enums"]["product_grade"] | null
          product_hero_url?: string | null
          product_id?: string | null
          product_name?: string
          product_sku?: string
          product_slug?: string
          quantity?: number
          unit_price_pence?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          created_at: string
          customer_id: string
          fulfilled_at: string | null
          id: string
          marketing_consent_order: boolean
          notes: string | null
          paid_at: string | null
          refunded_pence: number
          shipping_address: Json | null
          shipping_pence: number
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent: string | null
          stripe_session_id: string
          subtotal_pence: number
          total_pence: number
          updated_at: string
        }
        Insert: {
          billing_address?: Json | null
          created_at?: string
          customer_id: string
          fulfilled_at?: string | null
          id?: string
          marketing_consent_order?: boolean
          notes?: string | null
          paid_at?: string | null
          refunded_pence?: number
          shipping_address?: Json | null
          shipping_pence?: number
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent?: string | null
          stripe_session_id: string
          subtotal_pence: number
          total_pence: number
          updated_at?: string
        }
        Update: {
          billing_address?: Json | null
          created_at?: string
          customer_id?: string
          fulfilled_at?: string | null
          id?: string
          marketing_consent_order?: boolean
          notes?: string | null
          paid_at?: string | null
          refunded_pence?: number
          shipping_address?: Json | null
          shipping_pence?: number
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent?: string | null
          stripe_session_id?: string
          subtotal_pence?: number
          total_pence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          ai_suggested_at: string | null
          ai_suggestions: Json | null
          alt_text: string
          cloudinary_public_id: string
          cloudinary_url: string
          created_at: string
          id: string
          is_hero: boolean
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          ai_suggested_at?: string | null
          ai_suggestions?: Json | null
          alt_text?: string
          cloudinary_public_id: string
          cloudinary_url: string
          created_at?: string
          id?: string
          is_hero?: boolean
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          ai_suggested_at?: string | null
          ai_suggestions?: Json | null
          alt_text?: string
          cloudinary_public_id?: string
          cloudinary_url?: string
          created_at?: string
          id?: string
          is_hero?: boolean
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          condition: Database["public"]["Enums"]["product_condition"]
          condition_grade: Database["public"]["Enums"]["product_grade"] | null
          condition_notes: string | null
          cost_price_pence: number | null
          created_at: string
          description: string | null
          dimensions: Json | null
          id: string
          low_stock_alert: number | null
          name: string
          price_pence: number
          published_at: string | null
          refurb_date: string | null
          sku: string
          slug: string
          source: string | null
          specifications: Json | null
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          tags: string[] | null
          updated_at: string
          warehouse_location: string | null
          was_price_pence: number | null
          weight_kg: number | null
        }
        Insert: {
          brand?: string | null
          condition: Database["public"]["Enums"]["product_condition"]
          condition_grade?: Database["public"]["Enums"]["product_grade"] | null
          condition_notes?: string | null
          cost_price_pence?: number | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          id?: string
          low_stock_alert?: number | null
          name: string
          price_pence: number
          published_at?: string | null
          refurb_date?: string | null
          sku: string
          slug: string
          source?: string | null
          specifications?: Json | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          tags?: string[] | null
          updated_at?: string
          warehouse_location?: string | null
          was_price_pence?: number | null
          weight_kg?: number | null
        }
        Update: {
          brand?: string | null
          condition?: Database["public"]["Enums"]["product_condition"]
          condition_grade?: Database["public"]["Enums"]["product_grade"] | null
          condition_notes?: string | null
          cost_price_pence?: number | null
          created_at?: string
          description?: string | null
          dimensions?: Json | null
          id?: string
          low_stock_alert?: number | null
          name?: string
          price_pence?: number
          published_at?: string | null
          refurb_date?: string | null
          sku?: string
          slug?: string
          source?: string | null
          specifications?: Json | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          tags?: string[] | null
          updated_at?: string
          warehouse_location?: string | null
          was_price_pence?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      stock_reservations: {
        Row: {
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          expires_at: string
          id: string
          product_id: string
          quantity: number
          status: Database["public"]["Enums"]["reservation_status"]
          stripe_session_id: string
        }
        Insert: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          product_id: string
          quantity: number
          status?: Database["public"]["Enums"]["reservation_status"]
          stripe_session_id: string
        }
        Update: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          product_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["reservation_status"]
          stripe_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          product_id: string
          revoked_at: string | null
          token: string
          used_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          product_id: string
          revoked_at?: string | null
          token?: string
          used_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          product_id?: string
          revoked_at?: string | null
          token?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "upload_tokens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "upload_tokens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      product_available_stock: {
        Row: {
          available_stock: number | null
          product_id: string | null
          stock_quantity: number | null
        }
        Insert: {
          available_stock?: never
          product_id?: string | null
          stock_quantity?: number | null
        }
        Update: {
          available_stock?: never
          product_id?: string | null
          stock_quantity?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      category_kind: "functional" | "brand" | "merchandising"
      condition_severity: "faultless" | "light" | "moderate" | "significant"
      order_status:
        | "pending"
        | "paid"
        | "fulfilled"
        | "cancelled"
        | "refunded"
        | "backorder"
      product_condition: "new" | "used"
      product_grade: "A" | "B" | "C"
      product_status: "draft" | "live" | "archived"
      reservation_status: "active" | "confirmed" | "expired" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      category_kind: ["functional", "brand", "merchandising"],
      condition_severity: ["faultless", "light", "moderate", "significant"],
      order_status: [
        "pending",
        "paid",
        "fulfilled",
        "cancelled",
        "refunded",
        "backorder",
      ],
      product_condition: ["new", "used"],
      product_grade: ["A", "B", "C"],
      product_status: ["draft", "live", "archived"],
      reservation_status: ["active", "confirmed", "expired", "cancelled"],
    },
  },
} as const
