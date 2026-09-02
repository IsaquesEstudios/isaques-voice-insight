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
      livekit_agents: {
        Row: {
          contexto: string | null
          created_at: string
          id: string
          metadata: Json
          name: string
          perfil: string | null
          updated_at: string
          user_id: string
          voz: string | null
        }
        Insert: {
          contexto?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          perfil?: string | null
          updated_at?: string
          user_id: string
          voz?: string | null
        }
        Update: {
          contexto?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          perfil?: string | null
          updated_at?: string
          user_id?: string
          voz?: string | null
        }
        Relationships: []
      }
      meeting_join_requests: {
        Row: {
          created_at: string
          guest_name: string
          id: string
          room_code: string
          status: string
          token: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          guest_name: string
          id?: string
          room_code: string
          status?: string
          token?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          guest_name?: string
          id?: string
          room_code?: string
          status?: string
          token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_join_requests_room_code_fkey"
            columns: ["room_code"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      meeting_rooms: {
        Row: {
          assistente_ativa: boolean
          code: string
          created_at: string
          ended_at: string | null
          id: string
          name: string
          scheduled_at: string | null
          started_at: string | null
          transcrever: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          assistente_ativa?: boolean
          code: string
          created_at?: string
          ended_at?: string | null
          id?: string
          name: string
          scheduled_at?: string | null
          started_at?: string | null
          transcrever?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          assistente_ativa?: boolean
          code?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
          started_at?: string | null
          transcrever?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      telefones_usuarios: {
        Row: {
          created_at: string
          id: string
          telefone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          telefone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          telefone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transcricoes_reunioes: {
        Row: {
          conteudo: string
          criado_em: string
          id: string
          nome_sala: string
          user_id: string | null
        }
        Insert: {
          conteudo?: string
          criado_em?: string
          id?: string
          nome_sala: string
          user_id?: string | null
        }
        Update: {
          conteudo?: string
          criado_em?: string
          id?: string
          nome_sala?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_nvoip_credentials: {
        Row: {
          api_key: string | null
          client_id: string | null
          client_secret: string | null
          created_at: string
          friendly_label: string | null
          sip_host: string | null
          sip_password: string | null
          sip_username: string | null
          updated_at: string
          user_id: string
          vapi_credential_id: string | null
        }
        Insert: {
          api_key?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          friendly_label?: string | null
          sip_host?: string | null
          sip_password?: string | null
          sip_username?: string | null
          updated_at?: string
          user_id: string
          vapi_credential_id?: string | null
        }
        Update: {
          api_key?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          friendly_label?: string | null
          sip_host?: string | null
          sip_password?: string | null
          sip_username?: string | null
          updated_at?: string
          user_id?: string
          vapi_credential_id?: string | null
        }
        Relationships: []
      }
      user_phone_numbers: {
        Row: {
          assistant_id: string | null
          capabilities: Json | null
          country_iso: string | null
          created_at: string
          friendly_name: string | null
          id: string
          monthly_cost: number | null
          phone_number: string
          provider: string | null
          region: string | null
          twilio_sid: string | null
          updated_at: string
          user_id: string
          vapi_phone_number_id: string | null
        }
        Insert: {
          assistant_id?: string | null
          capabilities?: Json | null
          country_iso?: string | null
          created_at?: string
          friendly_name?: string | null
          id?: string
          monthly_cost?: number | null
          phone_number: string
          provider?: string | null
          region?: string | null
          twilio_sid?: string | null
          updated_at?: string
          user_id: string
          vapi_phone_number_id?: string | null
        }
        Update: {
          assistant_id?: string | null
          capabilities?: Json | null
          country_iso?: string | null
          created_at?: string
          friendly_name?: string | null
          id?: string
          monthly_cost?: number | null
          phone_number?: string
          provider?: string | null
          region?: string | null
          twilio_sid?: string | null
          updated_at?: string
          user_id?: string
          vapi_phone_number_id?: string | null
        }
        Relationships: []
      }
      user_test_contacts: {
        Row: {
          created_at: string
          id: string
          label: string | null
          phone_e164: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          phone_e164: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          phone_e164?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      user_vapi_credentials: {
        Row: {
          created_at: string
          friendly_label: string | null
          private_key: string | null
          public_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friendly_label?: string | null
          private_key?: string | null
          public_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friendly_label?: string | null
          private_key?: string | null
          public_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_vapi_settings: {
        Row: {
          created_at: string
          credits_budget: number | null
          low_balance_threshold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_budget?: number | null
          low_balance_threshold?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_budget?: number | null
          low_balance_threshold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_guest_meeting_info: {
        Args: { p_code: string }
        Returns: {
          ended_at: string
          name: string
          scheduled_at: string
        }[]
      }
      get_meeting_join_status: {
        Args: { p_id: string }
        Returns: {
          room_code: string
          status: string
          token: string
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
    Enums: {},
  },
} as const
