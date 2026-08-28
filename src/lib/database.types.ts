export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          vertical: string
          status: string
          timezone: string
          working_day_start: string
          working_day_end: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['organizations']['Row']>
        Update: Partial<Database['public']['Tables']['organizations']['Row']>
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: string
          status: string
          invited_by: string | null
          created_at: string
          updated_at: string
        }
      }
      company_roles: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string
          icon: string
          is_system: boolean
          created_at: string
          updated_at: string
        }
      }
      company_role_permissions: {
        Row: {
          company_role_id: string
          permission: string
        }
      }
      personnel: {
        Row: {
          id: string
          organization_id: string
          profile_id: string | null
          location_id: string | null
          company_role_id: string | null
          full_name: string
          title: string
          status: string
          skills: string[]
          created_at: string
          updated_at: string
        }
      }
      personnel_invites: {
        Row: {
          id: string
          organization_id: string
          personnel_id: string
          email: string
          token_hash: string
          expires_at: string
          accepted_at: string | null
          invited_by: string | null
          created_at: string
        }
      }
      organization_owner_invites: {
        Row: {
          id: string
          organization_id: string
          email: string
          full_name: string
          token_hash: string
          expires_at: string
          accepted_at: string | null
          invited_by: string | null
          created_at: string
        }
      }
      locations: {
        Row: {
          id: string
          organization_id: string
          name: string
          address: string | null
          timezone: string
          operating_hours: Json
          created_at: string
        }
      }
      calendar_items: {
        Row: {
          id: string
          organization_id: string
          location_id: string | null
          kind: string
          status: string
          title: string
          description: string | null
          starts_at: string
          ends_at: string
          timezone: string
          priority: string
          requires_acknowledgement: boolean
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
      }
      shift_assignments: {
        Row: {
          id: string
          organization_id: string
          calendar_item_id: string
          personnel_id: string
          status: string
          assigned_by: string | null
          confirmed_at: string | null
          created_at: string
        }
      }
      calendar_week_overrides: {
        Row: {
          id: string
          organization_id: string
          week_start_date: string
          show_all_hours: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          week_start_date: string
          show_all_hours?: boolean
        }
      }
      audit_log: {
        Row: {
          id: string
          organization_id: string | null
          actor_user_id: string | null
          action: string
          entity_table: string
          entity_id: string | null
          before: Json | null
          after: Json | null
          created_at: string
        }
      }
      platform_admins: {
        Row: {
          user_id: string
          created_at: string
          created_by: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          timezone: string
          created_at: string
          updated_at: string
        }
      }
    }
  }
}
