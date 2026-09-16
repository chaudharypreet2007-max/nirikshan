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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          inspection_id: string | null
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          inspection_id?: string | null
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          inspection_id?: string | null
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      barcode_lookup_logs: {
        Row: {
          barcode: string
          barcode_format: string | null
          created_at: string
          id: string
          lookup_source: string
          lookup_status: string
          product_id: string | null
          resulted_in_inspection: boolean
          user_id: string
        }
        Insert: {
          barcode: string
          barcode_format?: string | null
          created_at?: string
          id?: string
          lookup_source?: string
          lookup_status?: string
          product_id?: string | null
          resulted_in_inspection?: boolean
          user_id: string
        }
        Update: {
          barcode?: string
          barcode_format?: string | null
          created_at?: string
          id?: string
          lookup_source?: string
          lookup_status?: string
          product_id?: string | null
          resulted_in_inspection?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barcode_lookup_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rules: {
        Row: {
          applicable_package_type: string
          created_at: string
          declaration_key: string | null
          description: string | null
          effective_date: string
          id: string
          rule_code: string
          rule_name: string
          severity: Database["public"]["Enums"]["severity_level"]
          status: string
          version: number
        }
        Insert: {
          applicable_package_type?: string
          created_at?: string
          declaration_key?: string | null
          description?: string | null
          effective_date?: string
          id?: string
          rule_code: string
          rule_name: string
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: string
          version?: number
        }
        Update: {
          applicable_package_type?: string
          created_at?: string
          declaration_key?: string | null
          description?: string | null
          effective_date?: string
          id?: string
          rule_code?: string
          rule_name?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: string
          version?: number
        }
        Relationships: []
      }
      evidence_requests: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string
          id: string
          inspection_id: string
          request_description: string | null
          requested_by: string
          requested_items: Json
          review_id: string | null
          status: string
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          id?: string
          inspection_id: string
          request_description?: string | null
          requested_by: string
          requested_items?: Json
          review_id?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          inspection_id?: string
          request_description?: string | null
          requested_by?: string
          requested_items?: Json
          review_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_requests_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "supervisor_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      extracted_declarations: {
        Row: {
          confidence_score: number | null
          created_at: string
          declaration_type: string
          id: string
          inspection_id: string
          language: string | null
          normalized_value: string | null
          notes: string | null
          raw_text: string | null
          validation_status: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          declaration_type: string
          id?: string
          inspection_id: string
          language?: string | null
          normalized_value?: string | null
          notes?: string | null
          raw_text?: string | null
          validation_status?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          declaration_type?: string
          id?: string
          inspection_id?: string
          language?: string | null
          normalized_value?: string | null
          notes?: string | null
          raw_text?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "extracted_declarations_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          ai_raw: Json | null
          barcode: string | null
          barcode_source: string | null
          compliance_score: number | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          finalized_at: string | null
          id: string
          image_path: string | null
          image_quality_score: number | null
          inspection_date: string
          inspection_type: string
          inspector_id: string
          latitude: number | null
          location_label: string | null
          longitude: number | null
          organization_id: string | null
          package_context: string | null
          product_id: string | null
          product_match_score: number | null
          status: Database["public"]["Enums"]["compliance_status"]
          summary: string | null
          workflow_status: string
        }
        Insert: {
          ai_raw?: Json | null
          barcode?: string | null
          barcode_source?: string | null
          compliance_score?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          finalized_at?: string | null
          id?: string
          image_path?: string | null
          image_quality_score?: number | null
          inspection_date?: string
          inspection_type?: string
          inspector_id: string
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          organization_id?: string | null
          package_context?: string | null
          product_id?: string | null
          product_match_score?: number | null
          status?: Database["public"]["Enums"]["compliance_status"]
          summary?: string | null
          workflow_status?: string
        }
        Update: {
          ai_raw?: Json | null
          barcode?: string | null
          barcode_source?: string | null
          compliance_score?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          finalized_at?: string | null
          id?: string
          image_path?: string | null
          image_quality_score?: number | null
          inspection_date?: string
          inspection_type?: string
          inspector_id?: string
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          organization_id?: string | null
          package_context?: string | null
          product_id?: string | null
          product_match_score?: number | null
          status?: Database["public"]["Enums"]["compliance_status"]
          summary?: string | null
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          jurisdiction: string | null
          name: string
          organization_type: Database["public"]["Enums"]["org_type"]
          registration_number: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          jurisdiction?: string | null
          name: string
          organization_type?: Database["public"]["Enums"]["org_type"]
          registration_number?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          jurisdiction?: string | null
          name?: string
          organization_type?: Database["public"]["Enums"]["org_type"]
          registration_number?: string | null
        }
        Relationships: []
      }
      product_external_data: {
        Row: {
          barcode: string
          brand: string | null
          category: string | null
          country: string | null
          created_at: string
          expires_at: string | null
          external_product_id: string | null
          external_reference: string | null
          fetched_at: string
          id: string
          last_updated: string
          manufacturer: string | null
          package_quantity: string | null
          product_id: string | null
          product_image_url: string | null
          product_name: string | null
          raw_data: Json
          source_name: string
          unit: string | null
          verified: boolean
        }
        Insert: {
          barcode: string
          brand?: string | null
          category?: string | null
          country?: string | null
          created_at?: string
          expires_at?: string | null
          external_product_id?: string | null
          external_reference?: string | null
          fetched_at?: string
          id?: string
          last_updated?: string
          manufacturer?: string | null
          package_quantity?: string | null
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string | null
          raw_data?: Json
          source_name: string
          unit?: string | null
          verified?: boolean
        }
        Update: {
          barcode?: string
          brand?: string | null
          category?: string | null
          country?: string | null
          created_at?: string
          expires_at?: string | null
          external_product_id?: string | null
          external_reference?: string | null
          fetched_at?: string
          id?: string
          last_updated?: string
          manufacturer?: string | null
          package_quantity?: string | null
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string | null
          raw_data?: Json
          source_name?: string
          unit?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_external_data_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_identity_matches: {
        Row: {
          barcode: string | null
          created_at: string
          database_manufacturer: string | null
          database_product_name: string | null
          external_brand: string | null
          external_product_id: string | null
          external_product_name: string | null
          id: string
          inspection_id: string
          match_score: number | null
          ocr_brand: string | null
          ocr_manufacturer: string | null
          ocr_product_name: string | null
          status: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          database_manufacturer?: string | null
          database_product_name?: string | null
          external_brand?: string | null
          external_product_id?: string | null
          external_product_name?: string | null
          id?: string
          inspection_id: string
          match_score?: number | null
          ocr_brand?: string | null
          ocr_manufacturer?: string | null
          ocr_product_name?: string | null
          status?: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          database_manufacturer?: string | null
          database_product_name?: string | null
          external_brand?: string | null
          external_product_id?: string | null
          external_product_name?: string | null
          id?: string
          inspection_id?: string
          match_score?: number | null
          ocr_brand?: string | null
          ocr_manufacturer?: string | null
          ocr_product_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_identity_matches_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          created_at: string
          created_by: string | null
          external_data: Json | null
          external_last_updated: string | null
          external_product_id: string | null
          external_source: string | null
          id: string
          inspection_status: string
          manufacturer: string | null
          net_quantity: string | null
          organization_id: string | null
          package_type: string | null
          parent_product_id: string | null
          product_category: string | null
          product_name: string
          variant_name: string | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          created_at?: string
          created_by?: string | null
          external_data?: Json | null
          external_last_updated?: string | null
          external_product_id?: string | null
          external_source?: string | null
          id?: string
          inspection_status?: string
          manufacturer?: string | null
          net_quantity?: string | null
          organization_id?: string | null
          package_type?: string | null
          parent_product_id?: string | null
          product_category?: string | null
          product_name: string
          variant_name?: string | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          created_at?: string
          created_by?: string | null
          external_data?: Json | null
          external_last_updated?: string | null
          external_product_id?: string | null
          external_source?: string | null
          id?: string
          inspection_status?: string
          manufacturer?: string | null
          net_quantity?: string | null
          organization_id?: string | null
          package_type?: string | null
          parent_product_id?: string | null
          product_category?: string | null
          product_name?: string
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          designation: string | null
          email: string | null
          full_name: string | null
          id: string
          jurisdiction: string | null
          official_id: string | null
          organization_id: string | null
          portal_type: Database["public"]["Enums"]["portal_type"]
        }
        Insert: {
          created_at?: string
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          jurisdiction?: string | null
          official_id?: string | null
          organization_id?: string | null
          portal_type?: Database["public"]["Enums"]["portal_type"]
        }
        Update: {
          created_at?: string
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          jurisdiction?: string | null
          official_id?: string | null
          organization_id?: string | null
          portal_type?: Database["public"]["Enums"]["portal_type"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_reviews: {
        Row: {
          decision: string | null
          id: string
          inspection_id: string
          notes: string | null
          reason: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: string
          submitted_at: string
          submitted_by: string
        }
        Insert: {
          decision?: string | null
          id?: string
          inspection_id: string
          notes?: string | null
          reason: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
        }
        Update: {
          decision?: string | null
          id?: string
          inspection_id?: string
          notes?: string | null
          reason?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_reviews_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      violations: {
        Row: {
          confidence_score: number | null
          created_at: string
          description: string | null
          evidence: string | null
          id: string
          inspection_id: string
          recommendation: string | null
          rule_code: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          status: string
          violation_type: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          evidence?: string | null
          id?: string
          inspection_id: string
          recommendation?: string | null
          rule_code?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: string
          violation_type: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          evidence?: string | null
          id?: string
          inspection_id?: string
          recommendation?: string | null
          rule_code?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "violations_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_inspection: {
        Args: { _inspection_id: string; _user_id: string }
        Returns: boolean
      }
      can_oversee_inspector: {
        Args: { _admin_id: string; _inspector_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_gov: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin_of: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      my_org: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "gov_admin"
        | "inspector"
        | "org_admin"
        | "org_user"
        | "main_admin"
      compliance_status:
        | "compliant"
        | "needs_review"
        | "non_compliant"
        | "processing"
      org_type:
        | "government"
        | "private"
        | "manufacturer"
        | "retailer"
        | "inspection_agency"
      portal_type: "government" | "private" | "admin"
      severity_level: "low" | "medium" | "high" | "critical"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "super_admin",
        "gov_admin",
        "inspector",
        "org_admin",
        "org_user",
        "main_admin",
      ],
      compliance_status: [
        "compliant",
        "needs_review",
        "non_compliant",
        "processing",
      ],
      org_type: [
        "government",
        "private",
        "manufacturer",
        "retailer",
        "inspection_agency",
      ],
      portal_type: ["government", "private", "admin"],
      severity_level: ["low", "medium", "high", "critical"],
    },
  },
} as const
