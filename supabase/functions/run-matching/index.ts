import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type UserRecord = {
  id: string
  gender: string | null
}

type AnswerRecord = {
  user_id: string
  question_id: string
  answer_index: number | null
  answer_text: string | null
}

type QuestionRecord = {
  id: string
  category: string | null
  question_type: string | null
  text: string
}

type ScoreResult = {
  earned: number
  max: number
  strongMatch: boolean
  strongDifference: boolean
  textSignal: boolean
}

const CATEGORIES = ['mindset','emotional','lifestyle','money','habits','relationship']

const CATEGORY_REASON_TEMPLATES: Record<string, string> = {
  mindset: 'You tend to think through choices in a similar way, which creates a more natural mental rhythm.',
  emotional: 'Your emotional responses move at a similar pace, which makes the connection feel easier to read.',
  lifestyle: 'The way you move through everyday life feels more compatible than random.',
  money: 'You appear to think about security, comfort, and ambition through a similar lens.',
  habits: 'Your routines and self-management style suggest a compatible real-life pace.',
  relationship: 'You seem to want similar things from trust, closeness, and connection.'
}

function normalizeType(value: string | null | undefined) {
  return value === 'multiple_choice' ? 'options' : (value ?? 'options')
}

function tokenize(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2)
}

function scoreStructuredDistance(a: number, b: number, maxDistance: number) {
  const distance = Math.abs(a - b)
  const closeness = Math.max(0, 1 - distance / Math.max(1, maxDistance))
  return Math.round(closeness * 10)
}

function scoreTextSimilarity(a: string | null, b: string | null): ScoreResult {
  const tokensA = new Set(tokenize(a))
  const tokensB = new Set(tokenize(b))

  if (tokensA.size === 0 || tokensB.size === 0) {
    return { earned: 0, max: 4, strongMatch: false, strongDifference: false, textSignal: false }
  }

  const overlap = Array.from(tokensA).filter((token) => tokensB.has(token)).length
  const union = new Set([...tokensA, ...tokensB]).size
  const similarity = union > 0 ? overlap / union : 0

  if (similarity >= 0.6) {
    return { earned: 4, max: 4, strongMatch: true, strongDifference: false, textSignal: true }
  }

  if (similarity >= 0.25) {
    return { earned: 2, max: 4, strongMatch: false, strongDifference: false, textSignal: true }
  }

  return { earned: 0, max: 4, strongMatch: false, strongDifference: true, textSignal: false }
}

function scorePairAnswer(
  questionType: string | null,
  answerA: AnswerRecord | undefined,
  answerB: AnswerRecord | undefined
): ScoreResult {
  const normalizedType = normalizeType(questionType)

  if (!answerA || !answerB) {
    return { earned: 0, max: 0, strongMatch: false, strongDifference: false, textSignal: false }
  }

  if (normalizedType === 'slider') {
    const a = answerA.answer_index ?? 50
    const b = answerB.answer_index ?? 50
    const earned = scoreStructuredDistance(a, b, 100)
    return {
      earned,
      max: 10,
      strongMatch: earned >= 8,
      strongDifference: earned <= 2,
      textSignal: false
    }
  }

  if (normalizedType === 'binary') {
    const matched = answerA.answer_index === answerB.answer_index
    return {
      earned: matched ? 10 : 0,
      max: 10,
      strongMatch: matched,
      strongDifference: !matched,
      textSignal: false
    }
  }

  if (normalizedType === 'short_text' || normalizedType === 'fill_blank') {
    return scoreTextSimilarity(answerA.answer_text, answerB.answer_text)
  }

  const a = answerA.answer_index ?? 0
  const b = answerB.answer_index ?? 0
  const earned = scoreStructuredDistance(a, b, 3)
  return {
    earned,
    max: 10,
    strongMatch: earned >= 7,
    strongDifference: earned <= 3,
    textSignal: false
  }
}

function formatCategoryName(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
}

function topCategories(scores: Record<string, number>, limit = 3) {
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
}

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
    .select('id, gender')
    .in('id', userIds)
    .eq('verified', true)

  if (!users || users.length < 2) {
    return new Response(JSON.stringify({ error: 'Not enough users' }), { status: 400 })
  }

  const { data: answers } = await supabase
    .from('answers')
    .select('user_id, question_id, answer_index, answer_text')
    .eq('batch_id', batch_id)

  const { data: questions } = await supabase
    .from('questions')
    .select('id, category, question_type, text')

  const questionMap: Record<string, QuestionRecord> = {}
  for (const q of (questions || []) as QuestionRecord[]) questionMap[q.id] = q

  const byUser: Record<string, Record<string, AnswerRecord>> = {}
  for (const a of (answers || []) as AnswerRecord[]) {
    if (!byUser[a.user_id]) byUser[a.user_id] = {}
    byUser[a.user_id][a.question_id] = a
  }
  const pairs: any[] = []

  for (let i = 0; i < (users as UserRecord[]).length; i++) {
    for (let j = i + 1; j < (users as UserRecord[]).length; j++) {
      const a = (users as UserRecord[])[i], b = (users as UserRecord[])[j]
      const isOppositeGenderPair =
        (a.gender === 'Men' && b.gender === 'Women') ||
        (a.gender === 'Women' && b.gender === 'Men')
      if (!isOppositeGenderPair) continue

      const aA = byUser[a.id] || {}, bA = byUser[b.id] || {}
      const shared = Object.keys(aA).filter(qid => bA[qid] !== undefined)
      if (shared.length === 0) continue

      let earned = 0, max = 0
      const catEarned: Record<string, number> = {}
      const catMax: Record<string, number> = {}
      const strongMatchesByCategory: Record<string, number> = {}
      const textSignalsByCategory: Record<string, number> = {}
      for (const c of CATEGORIES) {
        catEarned[c] = 0
        catMax[c] = 0
        strongMatchesByCategory[c] = 0
        textSignalsByCategory[c] = 0
      }

      for (const qid of shared) {
        const question = questionMap[qid]
        const result = scorePairAnswer(question?.question_type, aA[qid], bA[qid])
        earned += result.earned
        max += result.max

        const cat = question?.category
        if (cat) {
          catEarned[cat] += result.earned
          catMax[cat] += result.max
          if (result.strongMatch) strongMatchesByCategory[cat] += 1
          if (result.textSignal) textSignalsByCategory[cat] += 1
        }
      }

      if (max === 0) continue

      const total = Math.round((earned / max) * 100)
      const catScores: Record<string, number> = {}
      for (const c of CATEGORIES) {
        catScores[c] = catMax[c] > 0
          ? Math.round((catEarned[c] / catMax[c]) * 100) : 0
      }

      const topCats = topCategories(catScores, 3)
      const reasons: string[] = []

      for (const [category] of topCats) {
        const baseReason = CATEGORY_REASON_TEMPLATES[category]
        if (baseReason) reasons.push(baseReason)
        if (reasons.length >= 3) break
      }

      const textHeavyCategory = Object.entries(textSignalsByCategory)
        .sort(([, aCount], [, bCount]) => bCount - aCount)[0]

      if (textHeavyCategory && textHeavyCategory[1] > 0 && reasons.length < 3) {
        reasons.push(`Even your written answers showed overlap, especially around ${formatCategoryName(textHeavyCategory[0]).toLowerCase()}.`)
      }

      if (reasons.length === 0) {
        reasons.push('The match came from a steady pattern across multiple answers rather than a single overlap.')
      }

      const summary = topCats.length >= 2
        ? `Your strongest alignment shows up in ${formatCategoryName(topCats[0][0]).toLowerCase()} and ${formatCategoryName(topCats[1][0]).toLowerCase()}, with a broader pattern that still holds across the rest of the batch questions.`
        : `This pairing came from a steady compatibility pattern across ${shared.length} shared answers.`

      pairs.push({
        a: a.id,
        b: b.id,
        total,
        catScores,
        summary,
        reasons,
        sharedCount: shared.length
      })
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
      category_scores: p.catScores,
      match_summary: p.summary,
      match_reasons: p.reasons,
      shared_answer_count: p.sharedCount
    })
  }

  await supabase.from('matches').delete().eq('batch_id', batch_id)

  if (inserts.length > 0) {
    await supabase.from('matches').insert(inserts)
  }

  await supabase.from('batches')
    .update({ reveal_ready: false }).eq('id', batch_id)

  return new Response(JSON.stringify({ matched: inserts.length }), { status: 200 })
})
