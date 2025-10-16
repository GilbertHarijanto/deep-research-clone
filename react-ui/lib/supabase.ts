// Supabase client setup for storing research sessions
// This will be used to save/load research history

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for research sessions
export interface ResearchSession {
  id: string
  user_id: string
  topic: string
  questions: Array<{ question: string; answer: string }>
  queries: Array<{ id: string; query: string; priority: number }>
  status: "in-progress" | "completed"
  created_at: string
  updated_at: string
}

// Helper functions for research session management
export async function saveResearchSession(userId: string, sessionData: Partial<ResearchSession>) {
  const { data, error } = await supabase
    .from("research_sessions")
    .insert({
      user_id: userId,
      ...sessionData,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Error saving research session:", error)
    throw error
  }

  return data
}

export async function updateResearchSession(sessionId: string, updates: Partial<ResearchSession>) {
  const { data, error } = await supabase
    .from("research_sessions")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single()

  if (error) {
    console.error("[v0] Error updating research session:", error)
    throw error
  }

  return data
}

export async function getResearchSessions(userId: string) {
  const { data, error } = await supabase
    .from("research_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching research sessions:", error)
    throw error
  }

  return data as ResearchSession[]
}

export async function getResearchSession(sessionId: string) {
  const { data, error } = await supabase.from("research_sessions").select("*").eq("id", sessionId).single()

  if (error) {
    console.error("[v0] Error fetching research session:", error)
    throw error
  }

  return data as ResearchSession
}
