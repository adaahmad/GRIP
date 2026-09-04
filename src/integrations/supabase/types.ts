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
      adaptation_strategies: {
        Row: {
          case_study_url: string | null
          co_benefits: string[]
          cost_tier: number
          created_at: string
          description: string
          effectiveness: number
          hazards: string[]
          id: string
          name: string
          slug: string
          timeline_years: number
          topography: string[]
        }
        Insert: {
          case_study_url?: string | null
          co_benefits?: string[]
          cost_tier?: number
          created_at?: string
          description: string
          effectiveness?: number
          hazards?: string[]
          id?: string
          name: string
          slug: string
          timeline_years?: number
          topography?: string[]
        }
        Update: {
          case_study_url?: string | null
          co_benefits?: string[]
          cost_tier?: number
          created_at?: string
          description?: string
          effectiveness?: number
          hazards?: string[]
          id?: string
          name?: string
          slug?: string
          timeline_years?: number
          topography?: string[]
        }
        Relationships: []
      }
      assets: {
        Row: {
          address: string | null
          annual_revenue_usd: number | null
          asset_type: string | null
          created_at: string
          geocode_status: string
          id: string
          lat: number
          lon: number
          name: string
          replacement_value_usd: number | null
          sector: string
        }
        Insert: {
          address?: string | null
          annual_revenue_usd?: number | null
          asset_type?: string | null
          created_at?: string
          geocode_status?: string
          id?: string
          lat: number
          lon: number
          name: string
          replacement_value_usd?: number | null
          sector?: string
        }
        Update: {
          address?: string | null
          annual_revenue_usd?: number | null
          asset_type?: string | null
          created_at?: string
          geocode_status?: string
          id?: string
          lat?: number
          lon?: number
          name?: string
          replacement_value_usd?: number | null
          sector?: string
        }
        Relationships: []
      }
      hazard_scores: {
        Row: {
          asset_id: string
          composite_2050: number | null
          composite_now: number | null
          computed_at: string
          expected_annual_loss_usd: number | null
          flood_2050: number | null
          flood_now: number | null
          heat_2050: number | null
          heat_now: number | null
          id: string
          methodology: Json | null
          sea_level_2050: number | null
          sea_level_now: number | null
          warnings: Json | null
          water_2050: number | null
          water_now: number | null
          wildfire_2050: number | null
          wildfire_now: number | null
          wind_2050: number | null
          wind_now: number | null
        }
        Insert: {
          asset_id: string
          composite_2050?: number | null
          composite_now?: number | null
          computed_at?: string
          expected_annual_loss_usd?: number | null
          flood_2050?: number | null
          flood_now?: number | null
          heat_2050?: number | null
          heat_now?: number | null
          id?: string
          methodology?: Json | null
          sea_level_2050?: number | null
          sea_level_now?: number | null
          warnings?: Json | null
          water_2050?: number | null
          water_now?: number | null
          wildfire_2050?: number | null
          wildfire_now?: number | null
          wind_2050?: number | null
          wind_now?: number | null
        }
        Update: {
          asset_id?: string
          composite_2050?: number | null
          composite_now?: number | null
          computed_at?: string
          expected_annual_loss_usd?: number | null
          flood_2050?: number | null
          flood_now?: number | null
          heat_2050?: number | null
          heat_now?: number | null
          id?: string
          methodology?: Json | null
          sea_level_2050?: number | null
          sea_level_now?: number | null
          warnings?: Json | null
          water_2050?: number | null
          water_now?: number | null
          wildfire_2050?: number | null
          wildfire_now?: number | null
          wind_2050?: number | null
          wind_now?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hazard_scores_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      region_metrics: {
        Row: {
          computed_at: string
          expires_at: string
          id: string
          metrics: Json
          region_id: string
          scenario: string
          source: string | null
          year: number
        }
        Insert: {
          computed_at?: string
          expires_at?: string
          id?: string
          metrics?: Json
          region_id: string
          scenario: string
          source?: string | null
          year: number
        }
        Update: {
          computed_at?: string
          expires_at?: string
          id?: string
          metrics?: Json
          region_id?: string
          scenario?: string
          source?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "region_metrics_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          annual_visitors: number | null
          baseline_revenue_usd: number | null
          bbox: Json | null
          country: string | null
          created_at: string
          description: string | null
          id: string
          lat: number
          lon: number
          name: string
          population: number | null
          sectors: string[]
          slug: string
          topography: string
        }
        Insert: {
          annual_visitors?: number | null
          baseline_revenue_usd?: number | null
          bbox?: Json | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat: number
          lon: number
          name: string
          population?: number | null
          sectors?: string[]
          slug: string
          topography: string
        }
        Update: {
          annual_visitors?: number | null
          baseline_revenue_usd?: number | null
          bbox?: Json | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number
          lon?: number
          name?: string
          population?: number | null
          sectors?: string[]
          slug?: string
          topography?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
