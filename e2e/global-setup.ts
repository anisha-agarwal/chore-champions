import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { ensureAuthUser, runSQL } from './supabase-admin'
import {
  TEST_PARENT_EMAIL, TEST_PARENT_PASSWORD,
  TEST_CHILD_EMAIL, TEST_CHILD_PASSWORD,
  TEST_FAMILY_NAME,
} from './test-constants'

async function globalSetup() {
  console.log('\n[Global Setup] Setting up E2E test accounts...')

  const parentId = await ensureAuthUser(TEST_PARENT_EMAIL, TEST_PARENT_PASSWORD, 'Test Parent')
  const childId = await ensureAuthUser(TEST_CHILD_EMAIL, TEST_CHILD_PASSWORD, 'Test Child')

  // Create/ensure test family — only insert if parent doesn't already have one
  const familyResult = await runSQL(`
    INSERT INTO families (name)
    SELECT '${TEST_FAMILY_NAME}'
    WHERE NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = '${parentId}' AND family_id IS NOT NULL
    )
    RETURNING id;
  `) as Array<{ id: string }>

  let familyId: string
  if (familyResult.length > 0) {
    familyId = familyResult[0].id
  } else {
    const existing = await runSQL(
      `SELECT family_id FROM profiles WHERE id = '${parentId}'`
    ) as Array<{ family_id: string }>
    familyId = existing[0].family_id
  }

  // Configure profiles with correct roles and family membership
  await runSQL(`
    UPDATE profiles SET family_id = '${familyId}', role = 'parent',
      display_name = 'Test Parent', points = 0 WHERE id = '${parentId}';
    UPDATE profiles SET family_id = '${familyId}', role = 'child',
      display_name = 'Test Child', points = 0 WHERE id = '${childId}';
  `)

  // Clean leftover test data from any previous failed run
  await runSQL(`
    DELETE FROM task_skips WHERE task_id IN (SELECT id FROM tasks WHERE family_id = '${familyId}');
    DELETE FROM task_completions WHERE task_id IN (SELECT id FROM tasks WHERE family_id = '${familyId}');
    DELETE FROM tasks WHERE family_id = '${familyId}';
    DELETE FROM family_invites WHERE family_id = '${familyId}';
  `)

  console.log('[Global Setup] Done!\n')
}

export default globalSetup
