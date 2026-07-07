// GET /api/staff-function-templates — templates de funções visíveis a todos
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = createServiceClient()

  const { data } = await admin
    .from('staff_function_templates')
    .select('id, name, staff_function_template_permissions(permission)')
    .eq('active', true)
    .order('sort_order')

  return NextResponse.json({ templates: data ?? [] })
}
