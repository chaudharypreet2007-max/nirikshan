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
          product_id: string | null
          status: Database["public"]["Enums"]["compliance_status"]
          summary: string | null
        }
        Insert: {
          ai_raw?: Json | null
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
          product_id?: string | null
          status?: Database["public"]["Enums"]["compliance_status"]
          summary?: string | null
        }
        Update: {
          ai_raw?: Json | null
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
          product_id?: string | null
          status?: Database["public"]["Enums"]["compliance_status"]
          summary?: string | null
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
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          created_at: string
          created_by: string | null
          id: string
          manufacturer: string | null
          organization_id: string | null
          package_type: string | null
          product_category: string | null
          product_name: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manufacturer?: string | null
          organization_id?: string | null
          package_type?: string | null
          product_category?: string | null
          product_name: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manufacturer?: string | null
          organization_id?: string | null
          package_type?: string | null
          product_category?: string | null
          product_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
