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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          body: string
          created_at: string
          created_by_id: string
          id: string
          question_id: string
          upvotes: number | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by_id: string
          id?: string
          question_id: string
          upvotes?: number | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by_id?: string
          id?: string
          question_id?: string
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_products: {
        Row: {
          id: string
          is_active: boolean | null
          name: string
          price_cents: number
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          name: string
          price_cents: number
        }
        Update: {
          id?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
        }
        Relationships: []
      }
      coffee_transactions: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          price_cents_snapshot: number
          product_id: string
          product_name_snapshot: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          price_cents_snapshot: number
          product_id: string
          product_name_snapshot: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          price_cents_snapshot?: number
          product_id?: string
          product_name_snapshot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coffee_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "coffee_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          audience_group: string | null
          created_at: string
          description: string | null
          ends_at: string
          external_registration_url: string | null
          id: string
          is_open_to_all: boolean | null
          location: string | null
          owner_id: string
          starts_at: string
          title: string
        }
        Insert: {
          audience_group?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          external_registration_url?: string | null
          id?: string
          is_open_to_all?: boolean | null
          location?: string | null
          owner_id: string
          starts_at: string
          title: string
        }
        Update: {
          audience_group?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          external_registration_url?: string | null
          id?: string
          is_open_to_all?: boolean | null
          location?: string | null
          owner_id?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      info_posts: {
        Row: {
          audience: Database["public"]["Enums"]["audience_type"]
          content: string
          created_at: string
          created_by_id: string
          id: string
          pinned: boolean | null
          title: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["audience_type"]
          content: string
          created_at?: string
          created_by_id: string
          id?: string
          pinned?: boolean | null
          title: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience_type"]
          content?: string
          created_at?: string
          created_by_id?: string
          id?: string
          pinned?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "info_posts_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kudos: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          message: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          message: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kudos_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kudos_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lunch_options: {
        Row: {
          id: string
          label: string
          round_id: string
        }
        Insert: {
          id?: string
          label: string
          round_id: string
        }
        Update: {
          id?: string
          label?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lunch_options_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "lunch_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      lunch_orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          option_id: string
          round_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          option_id: string
          round_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          option_id?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lunch_orders_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "lunch_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lunch_orders_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "lunch_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lunch_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lunch_rounds: {
        Row: {
          created_at: string
          deadline_at: string
          id: string
          reminder_sent: boolean | null
          responsible_user_id: string
          title: string
        }
        Insert: {
          created_at?: string
          deadline_at: string
          id?: string
          reminder_sent?: boolean | null
          responsible_user_id: string
          title: string
        }
        Update: {
          created_at?: string
          deadline_at?: string
          id?: string
          reminder_sent?: boolean | null
          responsible_user_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lunch_rounds_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_listings: {
        Row: {
          contact: string
          created_at: string
          created_by_id: string
          description: string
          expires_at: string | null
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["listing_kind"]
          title: string
        }
        Insert: {
          contact: string
          created_at?: string
          created_by_id: string
          description: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          kind: Database["public"]["Enums"]["listing_kind"]
          title: string
        }
        Update: {
          contact?: string
          created_at?: string
          created_by_id?: string
          description?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["listing_kind"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_listings_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_pairs: {
        Row: {
          id: string
          round_id: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          id?: string
          round_id: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          id?: string
          round_id?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_pairs_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "match_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_pairs_user_a_id_fkey"
            columns: ["user_a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_pairs_user_b_id_fkey"
            columns: ["user_b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participations: {
        Row: {
          id: string
          round_id: string
          user_id: string
        }
        Insert: {
          id?: string
          round_id: string
          user_id: string
        }
        Update: {
          id?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_participations_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "match_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_rounds: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["match_kind"]
          scheduled_date: string
          status: Database["public"]["Enums"]["match_status"] | null
          weekday: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["match_kind"]
          scheduled_date: string
          status?: Database["public"]["Enums"]["match_status"] | null
          weekday?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["match_kind"]
          scheduled_date?: string
          status?: Database["public"]["Enums"]["match_status"] | null
          weekday?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cost_center_code: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          cost_center_code?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          cost_center_code?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by_id: string
          id: string
          options: string[]
          title: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by_id: string
          id?: string
          options: string[]
          title: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by_id?: string
          id?: string
          options?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          first_aid_available: boolean | null
          first_aid_available_since: string | null
          first_aid_certified: boolean | null
          id: string
          name: string
          organization_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          skills_text: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          first_aid_available?: boolean | null
          first_aid_available_since?: string | null
          first_aid_certified?: boolean | null
          id: string
          name: string
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          skills_text?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          first_aid_available?: boolean | null
          first_aid_available_since?: string | null
          first_aid_certified?: boolean | null
          id?: string
          name?: string
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          skills_text?: string | null
          updated_at?: string
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
      questions: {
        Row: {
          accepted_answer_id: string | null
          body: string
          created_at: string
          created_by_id: string
          id: string
          is_solved: boolean | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          accepted_answer_id?: string | null
          body: string
          created_at?: string
          created_by_id: string
          id?: string
          is_solved?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          accepted_answer_id?: string | null
          body?: string
          created_at?: string
          created_by_id?: string
          id?: string
          is_solved?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          created_by_id: string
          id: string
          reason: string
          status: Database["public"]["Enums"]["report_status"] | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          created_at?: string
          created_by_id: string
          id?: string
          reason: string
          status?: Database["public"]["Enums"]["report_status"] | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          created_at?: string
          created_by_id?: string
          id?: string
          reason?: string
          status?: Database["public"]["Enums"]["report_status"] | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_bookings: {
        Row: {
          created_at: string
          decided_by_id: string | null
          ends_at: string
          id: string
          notes: string | null
          requester_id: string
          room_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"] | null
        }
        Insert: {
          created_at?: string
          decided_by_id?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          requester_id: string
          room_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"] | null
        }
        Update: {
          created_at?: string
          decided_by_id?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          requester_id?: string
          room_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_bookings_decided_by_id_fkey"
            columns: ["decided_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_bookings_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number | null
          equipment_text: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          capacity?: number | null
          equipment_text?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          capacity?: number | null
          equipment_text?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "SUPER_ADMIN" | "ORG_ADMIN" | "MEMBER"
      audience_type: "PUBLIC" | "INTERNAL"
      booking_status: "REQUESTED" | "APPROVED" | "DECLINED" | "CANCELLED"
      listing_kind: "OFFER" | "REQUEST" | "LOST_FOUND" | "RIDESHARE"
      match_kind: "LUNCH"
      match_status: "DRAFT" | "OPEN" | "PAIRED" | "CLOSED"
      notification_type:
        | "INFO"
        | "EVENT"
        | "QNA"
        | "BOOKING"
        | "LUNCH"
        | "COFFEE"
        | "POLL"
      report_status: "OPEN" | "RESOLVED"
      report_target: "QUESTION" | "ANSWER" | "POST"
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
      app_role: ["SUPER_ADMIN", "ORG_ADMIN", "MEMBER"],
      audience_type: ["PUBLIC", "INTERNAL"],
      booking_status: ["REQUESTED", "APPROVED", "DECLINED", "CANCELLED"],
      listing_kind: ["OFFER", "REQUEST", "LOST_FOUND", "RIDESHARE"],
      match_kind: ["LUNCH"],
      match_status: ["DRAFT", "OPEN", "PAIRED", "CLOSED"],
      notification_type: [
        "INFO",
        "EVENT",
        "QNA",
        "BOOKING",
        "LUNCH",
        "COFFEE",
        "POLL",
      ],
      report_status: ["OPEN", "RESOLVED"],
      report_target: ["QUESTION", "ANSWER", "POST"],
    },
  },
} as const
