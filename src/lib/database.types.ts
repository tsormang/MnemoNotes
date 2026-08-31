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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_icons: {
        Row: {
          avatar_gender: Database["public"]["Enums"]["avatar_gender"] | null
          created_at: string
          entity_types: Database["public"]["Enums"]["icon_entity_type"][]
          id: string
          label: string
          path: string
          sort_order: number
          tags: string[]
        }
        Insert: {
          avatar_gender?: Database["public"]["Enums"]["avatar_gender"] | null
          created_at?: string
          entity_types: Database["public"]["Enums"]["icon_entity_type"][]
          id: string
          label: string
          path: string
          sort_order?: number
          tags?: string[]
        }
        Update: {
          avatar_gender?: Database["public"]["Enums"]["avatar_gender"] | null
          created_at?: string
          entity_types?: Database["public"]["Enums"]["icon_entity_type"][]
          id?: string
          label?: string
          path?: string
          sort_order?: number
          tags?: string[]
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_table: string
          id: string
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_table: string
          id?: string
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string
          id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_item_acknowledgements: {
        Row: {
          acknowledged_at: string
          calendar_item_id: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          calendar_item_id: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          calendar_item_id?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_item_acknowledgements_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_item_acknowledgements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_items: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["calendar_item_kind"]
          location_id: string | null
          metadata: Json
          organization_id: string
          priority: string
          requires_acknowledgement: boolean
          starts_at: string
          status: Database["public"]["Enums"]["calendar_item_status"]
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          kind: Database["public"]["Enums"]["calendar_item_kind"]
          location_id?: string | null
          metadata?: Json
          organization_id: string
          priority?: string
          requires_acknowledgement?: boolean
          starts_at: string
          status?: Database["public"]["Enums"]["calendar_item_status"]
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["calendar_item_kind"]
          location_id?: string | null
          metadata?: Json
          organization_id?: string
          priority?: string
          requires_acknowledgement?: boolean
          starts_at?: string
          status?: Database["public"]["Enums"]["calendar_item_status"]
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_week_overrides: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          show_all_hours: boolean
          updated_at: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          show_all_hours?: boolean
          updated_at?: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          show_all_hours?: boolean
          updated_at?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_week_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_role_permissions: {
        Row: {
          company_role_id: string
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Insert: {
          company_role_id: string
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Update: {
          company_role_id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
        }
        Relationships: [
          {
            foreignKeyName: "company_role_permissions_company_role_id_fkey"
            columns: ["company_role_id"]
            isOneToOne: false
            referencedRelation: "company_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_roles: {
        Row: {
          created_at: string
          description: string
          icon_id: string
          id: string
          is_system: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon_id?: string
          id?: string
          is_system?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon_id?: string
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_roles_icon_id_fkey"
            columns: ["icon_id"]
            isOneToOne: false
            referencedRelation: "app_icons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          operating_hours: Json
          organization_id: string
          timezone: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          operating_hours?: Json
          organization_id: string
          timezone?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          operating_hours?: Json
          organization_id?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          notification_rule_id: string | null
          organization_id: string
          payload: Json
          recipient_user_id: string | null
          scheduled_for: string
          status: Database["public"]["Enums"]["notification_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          notification_rule_id?: string | null
          organization_id: string
          payload?: Json
          recipient_user_id?: string | null
          scheduled_for: string
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          notification_rule_id?: string | null
          organization_id?: string
          payload?: Json
          recipient_user_id?: string | null
          scheduled_for?: string
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_jobs_notification_rule_id_fkey"
            columns: ["notification_rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          calendar_item_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          enabled: boolean
          id: string
          offset_minutes: number
          organization_id: string
          trigger_kind: Database["public"]["Enums"]["notification_trigger"]
        }
        Insert: {
          calendar_item_id: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          id?: string
          offset_minutes?: number
          organization_id: string
          trigger_kind: Database["public"]["Enums"]["notification_trigger"]
        }
        Update: {
          calendar_item_id?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          id?: string
          offset_minutes?: number
          organization_id?: string
          trigger_kind?: Database["public"]["Enums"]["notification_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_owner_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          organization_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          invited_by?: string | null
          organization_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_owner_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          icon_id: string
          id: string
          name: string
          settings: Json
          status: string
          timezone: string
          updated_at: string
          vertical: Database["public"]["Enums"]["business_vertical"]
          working_day_end: string
          working_day_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          icon_id?: string
          id?: string
          name: string
          settings?: Json
          status?: string
          timezone?: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["business_vertical"]
          working_day_end?: string
          working_day_start?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          icon_id?: string
          id?: string
          name?: string
          settings?: Json
          status?: string
          timezone?: string
          updated_at?: string
          vertical?: Database["public"]["Enums"]["business_vertical"]
          working_day_end?: string
          working_day_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_icon_id_fkey"
            columns: ["icon_id"]
            isOneToOne: false
            referencedRelation: "app_icons"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel: {
        Row: {
          avatar_gender: Database["public"]["Enums"]["avatar_gender"]
          company_role_id: string | null
          created_at: string
          full_name: string
          icon_id: string
          id: string
          location_id: string | null
          organization_id: string
          profile_id: string | null
          skills: string[]
          status: Database["public"]["Enums"]["member_status"]
          title: string
          updated_at: string
        }
        Insert: {
          avatar_gender?: Database["public"]["Enums"]["avatar_gender"]
          company_role_id?: string | null
          created_at?: string
          full_name: string
          icon_id?: string
          id?: string
          location_id?: string | null
          organization_id: string
          profile_id?: string | null
          skills?: string[]
          status?: Database["public"]["Enums"]["member_status"]
          title?: string
          updated_at?: string
        }
        Update: {
          avatar_gender?: Database["public"]["Enums"]["avatar_gender"]
          company_role_id?: string | null
          created_at?: string
          full_name?: string
          icon_id?: string
          id?: string
          location_id?: string | null
          organization_id?: string
          profile_id?: string | null
          skills?: string[]
          status?: Database["public"]["Enums"]["member_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_company_role_id_fkey"
            columns: ["company_role_id"]
            isOneToOne: false
            referencedRelation: "company_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_icon_id_fkey"
            columns: ["icon_id"]
            isOneToOne: false
            referencedRelation: "app_icons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          personnel_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          organization_id: string
          personnel_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          personnel_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_invites_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_profiles: {
        Row: {
          default_note_categories: string[]
          license_reference: string | null
          metadata: Json
          organization_id: string
        }
        Insert: {
          default_note_categories?: string[]
          license_reference?: string | null
          metadata?: Json
          organization_id: string
        }
        Update: {
          default_note_categories?: string[]
          license_reference?: string | null
          metadata?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admin_actions: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      shift_assignments: {
        Row: {
          assigned_by: string | null
          calendar_item_id: string
          confirmed_at: string | null
          created_at: string
          id: string
          organization_id: string
          personnel_id: string
          status: string
        }
        Insert: {
          assigned_by?: string | null
          calendar_item_id: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          organization_id: string
          personnel_id: string
          status?: string
        }
        Update: {
          assigned_by?: string | null
          calendar_item_id?: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          personnel_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          target_organization_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: {
          requested_permission: Database["public"]["Enums"]["app_permission"]
          target_organization_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_permission:
        | "platform.admin"
        | "platform.users.read"
        | "platform.users.update"
        | "platform.users.delete"
        | "platform.tenants.read"
        | "platform.tenants.update"
        | "platform.tenants.delete"
        | "platform.records.hard_delete"
        | "organization.read"
        | "organization.update"
        | "users.invite"
        | "users.disable"
        | "roles.manage"
        | "locations.manage"
        | "personnel.manage"
        | "shifts.read"
        | "shifts.create"
        | "shifts.update"
        | "shifts.delete"
        | "shifts.assign"
        | "notes.read"
        | "notes.create"
        | "notes.update"
        | "notes.delete"
        | "notes.acknowledge"
        | "notifications.manage"
        | "audit.read"
        | "stats.read"
      app_role: "developer_admin" | "owner" | "manager" | "personnel" | "viewer"
      avatar_gender: "male" | "female"
      business_vertical: "pharmacy" | "generic"
      calendar_item_kind: "shift" | "note" | "task"
      calendar_item_status: "draft" | "published" | "cancelled" | "completed"
      icon_entity_type:
        | "organization"
        | "personnel"
        | "company_role"
        | "note"
        | "task"
      member_status: "invited" | "active" | "disabled"
      notification_channel: "in_app" | "push" | "email" | "sms" | "teams"
      notification_status:
        | "queued"
        | "sent"
        | "delivered"
        | "failed"
        | "acknowledged"
        | "expired"
      notification_trigger:
        | "before_start"
        | "at_start"
        | "during"
        | "before_end"
        | "after_end"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_permission: [
        "platform.admin",
        "platform.users.read",
        "platform.users.update",
        "platform.users.delete",
        "platform.tenants.read",
        "platform.tenants.update",
        "platform.tenants.delete",
        "platform.records.hard_delete",
        "organization.read",
        "organization.update",
        "users.invite",
        "users.disable",
        "roles.manage",
        "locations.manage",
        "personnel.manage",
        "shifts.read",
        "shifts.create",
        "shifts.update",
        "shifts.delete",
        "shifts.assign",
        "notes.read",
        "notes.create",
        "notes.update",
        "notes.delete",
        "notes.acknowledge",
        "notifications.manage",
        "audit.read",
        "stats.read",
      ],
      app_role: ["developer_admin", "owner", "manager", "personnel", "viewer"],
      avatar_gender: ["male", "female"],
      business_vertical: ["pharmacy", "generic"],
      calendar_item_kind: ["shift", "note", "task"],
      calendar_item_status: ["draft", "published", "cancelled", "completed"],
      icon_entity_type: [
        "organization",
        "personnel",
        "company_role",
        "note",
        "task",
      ],
      member_status: ["invited", "active", "disabled"],
      notification_channel: ["in_app", "push", "email", "sms", "teams"],
      notification_status: [
        "queued",
        "sent",
        "delivered",
        "failed",
        "acknowledged",
        "expired",
      ],
      notification_trigger: [
        "before_start",
        "at_start",
        "during",
        "before_end",
        "after_end",
      ],
    },
  },
} as const
