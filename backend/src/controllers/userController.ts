import { Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'

// Admin client — uses the service_role key to bypass RLS and call auth.admin.deleteUser
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!, // service_role key
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header.' })
    return
  }

  const token = authHeader.replace('Bearer ', '')

  // Verify the JWT and get the caller's userId
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    console.error('[deleteAccount] ❌ Invalid token:', authError?.message)
    res.status(401).json({ error: 'Unauthorized', message: 'Could not verify user identity.' })
    return
  }

  const userId = user.id
  console.log(`[deleteAccount] 🗑️  Account deletion requested for user: ${userId}`)

  try {
    // Step 1: Delete user data from all custom tables
    // ON DELETE CASCADE handles most of these via the profiles FK,
    // but we delete explicitly to be safe and log each step.

    const tables: { table: string; column: string }[] = [
      { table: 'candidate_memories', column: 'user_id' },
      { table: 'jobs', column: 'user_id' },
      { table: 'profiles', column: 'id' },
    ]

    for (const { table, column } of tables) {
      const { error } = await supabaseAdmin.from(table).delete().eq(column, userId)
      if (error) {
        // Log but don't fail — the auth deletion is the critical step
        console.warn(`[deleteAccount] ⚠️  Could not delete from ${table}:`, error.message)
      } else {
        console.log(`[deleteAccount] ✅ Deleted data from ${table}.`)
      }
    }

    // Step 2: Delete the user from Supabase Auth (requires admin client)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteAuthError) {
      console.error('[deleteAccount] ❌ Failed to delete auth user:', deleteAuthError.message)
      res.status(500).json({ error: 'Deletion Failed', message: deleteAuthError.message })
      return
    }

    console.log(`[deleteAccount] ✅ Auth user ${userId} permanently deleted.`)
    res.status(200).json({ success: true, message: 'Account permanently deleted.' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[deleteAccount] ❌ Unhandled error:', message)
    res.status(500).json({ error: 'Internal Server Error', message })
  }
}
