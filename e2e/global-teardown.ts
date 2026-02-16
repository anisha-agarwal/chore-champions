import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { runSQL } from './supabase-admin'
import { TEST_PARENT_EMAIL, TEST_CHILD_EMAIL } from './test-constants'

async function globalTeardown() {
  try {
    console.log('\n[Global Teardown] Cleaning up E2E test data...')

    const users = await runSQL(`
      SELECT id FROM auth.users WHERE email IN ('${TEST_PARENT_EMAIL}', '${TEST_CHILD_EMAIL}')
    `) as Array<{ id: string }>

    if (users.length === 0) return

    const families = await runSQL(`
      SELECT DISTINCT family_id FROM profiles
      WHERE id IN (${users.map(u => `'${u.id}'`).join(',')}) AND family_id IS NOT NULL
    `) as Array<{ family_id: string }>

    for (const { family_id } of families) {
      await runSQL(`
        DELETE FROM task_skips WHERE task_id IN (SELECT id FROM tasks WHERE family_id = '${family_id}');
        DELETE FROM task_completions WHERE task_id IN (SELECT id FROM tasks WHERE family_id = '${family_id}');
        DELETE FROM tasks WHERE family_id = '${family_id}';
        DELETE FROM family_invites WHERE family_id = '${family_id}';
      `)
    }

    for (const { id } of users) {
      await runSQL(`UPDATE profiles SET points = 0 WHERE id = '${id}'`)
    }

    console.log('[Global Teardown] Done!\n')
  } catch (error) {
    console.error('[Global Teardown] Error:', error)
  }
}

export default globalTeardown
