import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const { batch_id } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: registrations } = await supabase
    .from('batch_registrations')
    .select('user_id')
    .eq('batch_id', batch_id)

  const userIds = (registrations || []).map((registration) => registration.user_id)

  if (userIds.length < 2) {
    return new Response(JSON.stringify({ error: 'Not enough users' }), { status: 400 })
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, gender, interested_in')
    .in('id', userIds)
    .eq('verified', true)

  if (!users || users.length < 2) {
    return new Response(JSON.stringify({ error: 'Not enough users' }), { status: 400 })
  }

  const { data: answers } = await supabase
    .from('answers')
    .select('user_id, question_id, answer_index')
    .eq('batch_id', batch_id)

  const { data: questions } = await supabase
    .from('questions')
    .select('id, category')

  const qMap: Record<string, string> = {}
  for (const q of questions || []) qMap[q.id] = q.category

  const byUser: Record<string, Record<string, number>> = {}
  for (const a of answers || []) {
    if (!byUser[a.user_id]) byUser[a.user_id] = {}
    byUser[a.user_id][a.question_id] = a.answer_index
  }

  const score = (a: number, b: number) => {
    const d = Math.abs(a - b)
    if (d === 0) return 10
    if (d === 1) return 6
    if (d === 2) return 3
    return 0
  }

  const categories = ['mindset','emotional','lifestyle','money','habits','relationship']
  const pairs: any[] = []

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const a = users[i], b = users[j]
      const wantsMatch =
        (a.interested_in === 'Everyone' || a.interested_in === b.gender) &&
        (b.interested_in === 'Everyone' || b.interested_in === a.gender)
      if (!wantsMatch) continue

      const aA = byUser[a.id] || {}, bA = byUser[b.id] || {}
      const shared = Object.keys(aA).filter(qid => bA[qid] !== undefined)
      if (shared.length === 0) continue

      let earned = 0, max = 0
      const catEarned: Record<string, number> = {}
      const catMax: Record<string, number> = {}
      for (const c of categories) { catEarned[c] = 0; catMax[c] = 0 }

      for (const qid of shared) {
        const s = score(aA[qid], bA[qid])
        earned += s; max += 10
        const cat = qMap[qid]
        if (cat) { catEarned[cat] += s; catMax[cat] += 10 }
      }

      const total = Math.round((earned / max) * 100)
      const catScores: Record<string, number> = {}
      for (const c of categories) {
        catScores[c] = catMax[c] > 0
          ? Math.round((catEarned[c] / catMax[c]) * 100) : 0
      }

      pairs.push({ a: a.id, b: b.id, total, catScores })
    }
  }

  const matched = new Set<string>()
  const inserts: any[] = []
  pairs.sort((x, y) => y.total - x.total)

  for (const p of pairs) {
    if (matched.has(p.a) || matched.has(p.b)) continue
    matched.add(p.a)
    matched.add(p.b)
    inserts.push({
      batch_id,
      user_a: p.a,
      user_b: p.b,
      total_score: p.total,
      category_scores: p.catScores
    })
  }

  await supabase.from('matches').insert(inserts)
  await supabase.from('batches')
    .update({ status: 'complete' }).eq('id', batch_id)

  return new Response(JSON.stringify({ matched: inserts.length }), { status: 200 })
})
