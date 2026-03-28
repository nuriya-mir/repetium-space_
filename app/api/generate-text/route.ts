import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'

// Claude Code sets empty ANTHROPIC_* shell env vars that override .env.local.
// Fall back to reading .env.local directly when the shell var is empty.
function resolveApiKey(): string | undefined {
  const fromEnv = process.env.ANTHROPIC_API_KEY
  if (fromEnv) return fromEnv
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    const match = raw.match(/^ANTHROPIC_API_KEY=(.+)$/m)
    return match?.[1]?.trim() || undefined
  } catch {
    return undefined
  }
}

const anthropic = new Anthropic({ apiKey: resolveApiKey(), authToken: null })

export async function POST(req: NextRequest) {
  const { group_id, letter_targets, format = 'normal', difficulty_step = 1 } = await req.json()

  const cache_key = createHash('sha256')
    .update(JSON.stringify({ group_id, letter_targets, format, difficulty_step }))
    .digest('hex')

  // Try Supabase cache
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: cached } = await supabase
      .from('generated_texts')
      .select('*')
      .eq('cache_key', cache_key)
      .single()
    if (cached) return NextResponse.json(cached)
  } catch {
    // Supabase not available — generate directly
  }

  const target = (group_id === 'g4' || group_id === 'g7' || group_id === 'g8' || group_id === 'g10' || group_id === 'g16') ? letter_targets.join('|') : (letter_targets[0] ?? '')
  const { system, user } = buildPrompt(group_id, target)

  let content: string
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    })
    content = (response.content.find(b => b.type === 'text')?.text ?? '').trim().replace(/^#+\s*/gm, '')
  } catch (err) {
    console.error('[generate-text] Anthropic error:', err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  // G4, G6, G7, G10, G13, G14, G16, G19, G20 have no occurrence/position constraints — text is used as-is
  if (group_id !== 'g4' && group_id !== 'g6' && group_id !== 'g7' && group_id !== 'g8' && group_id !== 'g9' && group_id !== 'g10' && group_id !== 'g13' && group_id !== 'g14' && group_id !== 'g16' && group_id !== 'g19' && group_id !== 'g20') {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const countPattern = new RegExp(escaped, 'gi')
    const endOfWordPattern = new RegExp(escaped + '(?=[^a-zA-ZÀ-ÿœæ]|$)', 'gi')

    function checkText(text: string): string[] {
      const count = (text.match(countPattern) ?? []).length
      const problems: string[] = []
      if (count < 11) problems.push(`seulement ${count} occurrences de «${target}» — minimum 12 requis`)
      if (group_id !== 'g1' && endOfWordPattern.test(text)) problems.push(`«${target}» apparaît en fin de mot — interdit`)
      return problems
    }

    // Fallback: one fresh retry if constraints not satisfied
    const problems = checkText(content)
    if (problems.length > 0) {
      try {
        const retry = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system,
          messages: [{
            role: 'user',
            content: user + `\n\nATTENTION CRITIQUE: La tentative précédente a échoué (${problems.join('; ')}). Commence par lister 20 mots contenant «${target}» dans la bonne position, puis construis le texte autour de ces mots.`,
          }],
        })
        const fixed = retry.content.find(b => b.type === 'text')?.text.trim()
        if (fixed) content = fixed
      } catch {
        // Use first attempt
      }
    }
  }

  // Try to cache in Supabase
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.from('generated_texts').insert({
      cache_key,
      group_id,
      letter_targets,
      format,
      content,
      word_count: content.split(/\s+/).length,
    })
  } catch {
    // Cache unavailable — return uncached result
  }

  return NextResponse.json({ content, cache_key, group_id, letter_targets })
}

function getEndingExamples(endingKey: string): string {
  const examples: Record<string, string> = {
    '-tion': 'information, éducation, situation, attention, imagination, création',
    '-ment': 'doucement, tranquillement, vraiment, moment, changement, facilement',
    '-eux': 'heureux, merveilleux, courageux, dangereux, joyeux',
    '-eur': 'douceur, bonheur, couleur, chaleur, hauteur',
    '-oir': 'espoir, miroir, pouvoir, savoir, vouloir',
    '-age': 'courage, voyage, village, paysage, message',
    '-ette': 'recette, chouette, bicyclette, fillette, fenêtre',
    '-ance/-ence': 'confiance, patience, silence, élégance, présence',
    '-ible/-able': 'possible, formidable, agréable, incroyable, aimable',
  }
  return examples[endingKey] ?? 'words with this ending'
}

function buildPrompt(group_id: string, target: string): { system: string; user: string } {
  // G7: silent final letters — motivational text rich in words ending with target silent letter(s)
  if (group_id === 'g7') {
    const letters = target.split('|').filter(Boolean)
    const SILENT_EXAMPLES: Record<string, string> = {
      t: 'petit, chat, est, fait, nuit, concert, chocolat, tout, droit, art, bruit, respect',
      s: 'les, des, mais, toujours, après, temps, gros, bras, corps, repas, pays, jamais',
      d: 'grand, froid, chaud, bavard, gourmand, sourd, nid, pied, canard, marchand',
      x: 'voix, noix, choix, doux, heureux, faux, deux, mieux, cheveux, paix',
      e: 'vie, rue, joie, pluie, amie, lumière, fenêtre, voiture, cuisine, journée, promenade',
      p: 'trop, beaucoup, coup, loup, drap, sirop, galop',
      z: 'chez, riz, nez',
    }
    const EXCEPTIONS_HINT: Record<string, string> = {
      t: 'Do NOT use: net, sept, ouest, brut, but, scout',
      s: 'Do NOT use: bus, tennis, mars, fils, sens, iris',
      d: 'Do NOT use: sud',
      x: 'Do NOT use: index, latex',
      e: 'Only unaccented final e is silent. Do NOT use words ending in é, è, ê',
      p: 'Do NOT use: cap, stop',
      z: 'Do NOT use: gaz',
    }
    const letterRules = letters.length === 1
      ? `Minimum 10 words ending in silent «${letters[0]}» (not pronounced). Examples: ${SILENT_EXAMPLES[letters[0]] ?? ''}. ${EXCEPTIONS_HINT[letters[0]] ?? ''}.`
      : letters.map(l => `Minimum ${Math.max(3, Math.floor(10 / letters.length))} words ending in silent «${l}» (not pronounced, examples: ${(SILENT_EXAMPLES[l] ?? '').split(',').slice(0,4).join(',')})`).join('; ') + '. Total at least 10 words with silent final letters.'
    return {
      system: `Tu es un générateur de textes pédagogiques en français pour l'apprentissage de la lecture. Tu crées des textes motivants qui contiennent de nombreux mots se terminant par des lettres finales muettes.`,
      user: `Écris un texte motivant et chaleureux en français de 90 à 120 mots.\n\nRègles:\n- Uniquement des phrases déclaratives (pas de ? ni de !)\n- Ton chaud et bienveillant, sans sujets négatifs\n- Pas de listes ni de tirets\n- ${letterRules}\n- Les mots cibles doivent être répartis uniformément dans tout le texte\n- Alterne phrases courtes (5–8 mots) et moyennes (9–14 mots)\n\nRetourne uniquement le texte français, rien d'autre.`,
    }
  }

  // G8: internal silent letters — text rich in words containing silent h / qu / gu / gn
  if (group_id === 'g8') {
    const keys = target.split('|').filter(Boolean)
    const EXAMPLES: Record<string, string> = {
      h:  'homme, heure, hiver, théâtre, cahier, bonheur, dehors, habitude, histoire, honnête',
      qu: 'que, qui, quatre, quand, quoi, qualité, quelque, question, quitter, tranquille',
      gu: 'guerre, guide, guitare, guêpe, vague, langue, bague, figue, digue, distinguer',
      gn: 'ligne, magnifique, agneau, signal, montagne, champagne, gagner, signe, vigne, besogne',
    }
    const rules = keys.length === 1
      ? `Minimum 10 mots contenant le motif «${keys[0]}» avec la lettre muette. Exemples : ${EXAMPLES[keys[0]] ?? keys[0]}.`
      : keys.map(k => `Minimum ${Math.max(3, Math.floor(10 / keys.length))} mots avec «${k}» muet (exemples : ${(EXAMPLES[k] ?? k).split(',').slice(0, 4).join(',')})`).join('; ') + '. Total au moins 10 mots avec les lettres muettes cibles.'
    return {
      system: `Tu es un générateur de textes pédagogiques en français pour l'apprentissage de la lecture. Tu crées des textes motivants contenant de nombreux mots avec des lettres muettes internes.`,
      user: `Écris un texte motivant et chaleureux en français de 90 à 120 mots.\n\nRègles:\n- Uniquement des phrases déclaratives (pas de ? ni de !)\n- Ton chaud et bienveillant, sans sujets négatifs\n- Pas de listes ni de tirets\n- ${rules}\n- Les mots cibles doivent être répartis uniformément dans tout le texte\n- Alterne phrases courtes (5–8 mots) et moyennes (9–14 mots)\n\nRetourne uniquement le texte français, rien d'autre.`,
    }
  }

  // G9: sleeping letters — word pairs (silent form / awaken form)
  if (group_id === 'g9') {
    const letter = target
    const examples: Record<string, string> = {
      d: 'grand / grande, chaud / chaude, froid / froide, blond / blonde, gourmand / gourmande',
      t: 'petit / petite, fort / forte, haut / haute, court / courte, lent / lente',
      s: 'gris / grise, gros / grosse, bas / basse, mauvais / mauvaise, précis / précise',
      x: 'heureux / heureuse, doux / douce, faux / fausse, jaloux / jalouse, roux / rousse',
      p: 'loup / louve, drap / draper, sirop / siroter, galop / galoper, cantaloup / cantaloupe',
      n: 'bon / bonne, brun / brune, fin / fine, voisin / voisine, certain / certaine',
    }
    const ex = examples[letter] ?? examples['d']
    return {
      system: `Tu es un expert en phonétique française et en orthographe. Tu génères des listes de paires de mots français pour l'exercice «Lettres endormies» — des mots où une consonne finale muette «s'éveille» dans une forme apparentée.`,
      user: `Génère 8 paires de mots français pour la lettre endormie «${letter}».\n\nChaque paire : mot_muet / mot_éveillé (une paire par ligne).\nExemples : ${ex}\n\nRègles STRICTES :\n- Le mot_muet doit se terminer par «${letter}» (consonne NON prononcée)\n- Le mot_éveillé doit être un mot apparenté où «${letter}» EST prononcée\n- Paires morphologiquement liées (même famille de mots)\n- Tous les mots sont réels et courants\n- Sans répétition de racine\n- Format exact : mot_muet / mot_éveillé (une paire par ligne)\n\nRetourne UNIQUEMENT les 8 paires, rien d'autre.`,
    }
  }

  // G10: word endings — motivational text with target suffixes (-tion, -ment, etc.)
  if (group_id === 'g10') {
    const endings = target.split('|').filter(Boolean)
    const endingRules = endings.length === 1
      ? `Minimum 8 words ending in «${endings[0].replace('-', '')}». Examples: ${getEndingExamples(endings[0])}.`
      : endings.map(e => `Minimum ${Math.max(2, Math.floor(8 / endings.length))} words ending in «${e.replace('-', '')}»`).join('; ') + '. Total at least 8 words with target endings.'
    return {
      system: `Tu es un générateur de textes pédagogiques en français pour l'apprentissage de la lecture. Tu crées des textes motivants qui mettent en valeur des suffixes cibles.`,
      user: `Écris un texte motivant et chaleureux en français de 130 à 160 mots.\n\nRègles:\n- Uniquement des phrases déclaratives (pas de ? ni de !)\n- Ton chaud et bienveillant, sans sujets négatifs\n- Pas de listes ni de tirets\n- ${endingRules}\n- Les mots avec les suffixes cibles doivent être répartis uniformément dans tout le texte\n- Alterne phrases courtes (5–8 mots) et moyennes (9–14 mots)\n\nRetourne uniquement le texte français, rien d'autre.`,
    }
  }

  // G4: nasal sounds — motivational text with target nasal phonemes
  if (group_id === 'g4') {
    const nasals = target.split('|').filter(Boolean)
    const NASAL_IPA: Record<string, string> = {
      an: '[ɑ̃]', en: '[ɑ̃]', on: '[ɔ̃]', in: '[ɛ̃]', un: '[œ̃]', ain: '[ɛ̃]', oin: '[wɛ̃]'
    }
    const NASAL_EXAMPLES: Record<string, string> = {
      an: 'France, dans, grand, enfant, blanc, pendant, maman',
      en: 'lentement, moment, content, vent, souvent, vraiment, également',
      on: 'bonjour, maison, monde, bon, chanson, raison, leçon, saison',
      in: 'jardin, matin, fin, chemin, voisin, moulin, destin',
      un: 'lundi, brun, chacun, parfum, aucun, commun',
      ain: 'pain, main, demain, certain, train, bain, terrain',
      oin: 'loin, coin, point, besoin, soin, témoin',
    }
    const nasalRules = nasals.length === 1
      ? `Minimum 8 words containing the nasal «${nasals[0]}» ${NASAL_IPA[nasals[0]] ?? ''} (where «${nasals[0]}» produces a nasal vowel — only before a consonant or at end of word, NEVER before a vowel). Examples: ${NASAL_EXAMPLES[nasals[0]] ?? nasals[0]}.`
      : nasals.map(n => `Minimum ${Math.max(2, Math.floor(8 / nasals.length))} words with nasal «${n}» ${NASAL_IPA[n] ?? ''} (examples: ${(NASAL_EXAMPLES[n] ?? n).split(',').slice(0,3).join(',')})`).join('; ') + '. Total at least 8 nasal occurrences.'
    return {
      system: `Tu es un générateur de textes pédagogiques en français pour l'apprentissage de la lecture. Tu crées des textes motivants mettant en valeur les voyelles nasales françaises.`,
      user: `Écris un texte motivant et chaleureux en français de 90 à 110 mots.\n\nRègles:\n- Uniquement des phrases déclaratives (pas de ? ni de !)\n- Ton chaud et bienveillant, sans sujets négatifs\n- Pas de listes ni de tirets\n- ${nasalRules}\n- RÈGLE CRITIQUE : les nasales cibles doivent être dans une position NASALE réelle (avant consonne ou en fin de mot). NE PAS utiliser de mots où la nasale est suivie d'une voyelle (ananas, animal, banane) ou d'une consonne doublée (année, innocent).\n- Les mots avec nasales cibles doivent être répartis uniformément\n- Alterne phrases courtes (5–8 mots) et moyennes (9–14 mots)\n\nRetourne uniquement le texte français, rien d'autre.`,
    }
  }

  // G6: contextual readings — both reading contexts of one letter must appear
  if (group_id === 'g6') {
    const rules: Record<string, string> = {
      c: `Inclure au moins 5 mots avec c=[k] (avant a, o, u, ou consonne: calme, café, courage, couleur, comme, corps, accord, car, cœur, octobre) ET au moins 5 mots avec c=[s] (avant e, i, y: ciel, certain, douceur, commence, ici, face, place, cinq, avancer, service). La lettre «c» doit apparaître au moins 10 fois.`,
      g: `Inclure au moins 5 mots avec g=[g] (avant a, o, u, ou consonne: grand, regard, galerie, globe, légume, regard, grâce, goût) ET au moins 5 mots avec g=[ʒ] (avant e, i, y: gentil, manger, voyage, gens, image, page, sage, gilet). La lettre «g» doit apparaître au moins 10 fois.`,
      s: `Inclure au moins 5 mots avec s=[s] (début de mot ou ss double: soleil, sourire, soin, semaine, passer, possible, chose) ET au moins 5 mots avec s=[z] (s intervocalique: rose, maison, raison, choisir, musique, plaisir, oiseau, brise, cuisine). La lettre «s» doit apparaître au moins 10 fois.`,
      h: `Inclure au moins 4 mots avec h muet (qui permet la liaison: heure, heureux, histoire, honneur, homme, habitude, horizon, herbe) ET au moins 4 mots avec h aspiré (qui bloque la liaison: haricot, hasard, haut, héros, honte). La lettre «h» doit apparaître au moins 8 fois.`,
      x: `Inclure au moins 4 mots avec x=[ks] (taxi, texte, luxe, exercice, expérience, extra, fixe, boxe) ET au moins 4 mots avec x=[gz] (examen, exemple, exact, exiger, exil). La lettre «x» doit apparaître au moins 8 fois.`,
    }
    return {
      system: `Tu es un générateur de textes pédagogiques en français pour l'apprentissage de la lecture. Tu crées des textes naturels intégrant les deux lectures d'une même lettre.`,
      user: `Écris un texte motivant et chaleureux en français de 120 à 150 mots.\n\nRègles:\n- Uniquement des phrases déclaratives (pas de ? ni de !)\n- Ton chaud et bienveillant\n- Pas de sujets négatifs, pas de listes\n- ${rules[target] ?? rules['c']}\n\nRetourne uniquement le texte français, rien d'autre.`,
    }
  }

  // G13: syllable division — list of words with French syllable breakdown
  if (group_id === 'g13') {
    const parts = target.split(',')
    const count = Math.min(15, Math.max(5, parseInt(parts[0]) || 10))
    const sylls = Math.min(4, Math.max(2, parseInt(parts[1]) || 2))
    const syllDesc = sylls === 4 ? '4 or more' : `exactly ${sylls}`
    return {
      system: `Tu es un expert en phonétique française et en slyllabation. Tu génères des listes de mots français réels avec leur découpage en syllabes selon les règles françaises.`,
      user: `Génère ${count} mots français réels avec ${syllDesc === 'exactly 2' ? 'exactement 2 syllabes' : syllDesc === 'exactly 3' ? 'exactement 3 syllabes' : '4 syllabes ou plus'}, découpés en syllabes selon les règles françaises.\n\nRègles CRITIQUES de syllabation française:\n- Syllabes ouvertes préférées : ca-fé (pas caf-é), pa-pier (pas pap-ier)\n- Les digrammes restent ensemble : ch, ou, ai, an, on, in, gn, eau, au, ou\n- Les consonnes doubles se divisent : pom-me, bel-le\n- Les voyelles nasales ne se divisent pas : an, on, in, un\n\nFormat strict (un mot par ligne):\nchocolat = cho-co-lat\npapillon = pa-pi-llon\n\nMots du vocabulaire courant français (fréquents, connus). Retourne UNIQUEMENT la liste, rien d'autre.`,
    }
  }

  // G14: pseudowords — list of invented French-like words, count encoded in target
  if (group_id === 'g14') {
    const count = Math.min(20, Math.max(5, parseInt(target) || 10))
    return {
      system: `Tu es un générateur de pseudo-mots pour l'apprentissage de la lecture du français. Tu crées des mots inventés qui respectent la phonétique française sans exister dans aucun dictionnaire.`,
      user: `Génère ${count} pseudo-mots français.\n\nRègles strictes:\n- Chaque mot doit être INVENTÉ — ne pas exister en français, anglais, ou autre langue\n- 4 à 8 lettres par mot\n- Utilise de vraies combinaisons françaises : ou, ai, ch, eau, -tion, an, on, in, gn, qu, oi, eu, au, ill, ent, etc.\n- Prononçable sans ambiguïté par les règles de la phonétique française\n- Pas de mots grossiers dans aucune langue\n- Lettres françaises uniquement (diacritiques autorisés: é, è, ê, ë, ç, î, ï, ô, û, ù, â, à, œ)\n\nExemples de bons pseudo-mots: tourain, mondel, chaviton, bresseau, plondier, gauvette, frouvent, chalire, monteux\n\nRetourne UNIQUEMENT la liste, un mot par ligne, sans numéros ni ponctuation ni commentaires.`,
    }
  }

  // G16: prepositions — text with high density of selected prepositions
  if (group_id === 'g16') {
    const preps = target.split('|').filter(Boolean)
    const prepRules = preps.length === 1
      ? `Minimum 10 occurrences of the preposition «${preps[0]}» as a standalone word (never as part of contractions like du, au, des, aux). Examples: ${preps[0]} la rue, ${preps[0]} le jardin, ${preps[0]} un moment, ${preps[0]} la lumière.`
      : preps.map(p => `Minimum ${Math.max(3, Math.floor(10 / preps.length))} occurrences of preposition «${p}»`).join('; ') + '. Total at least 10 preposition occurrences.'
    return {
      system: `Tu es un générateur de textes pédagogiques en français pour l'apprentissage de la lecture. Tu crées des textes de type promenade ou parcours qui mettent naturellement en valeur des prépositions cibles.`,
      user: `Écris un texte de type promenade ou parcours en français de 130 à 160 mots.\n\nRègles:\n- Uniquement des phrases déclaratives (pas de ? ni de !)\n- Ton chaud et bienveillant\n- Pas de listes ni de tirets\n- ${prepRules}\n- Les prépositions cibles doivent être réparties uniformément dans tout le texte\n- Alterne phrases courtes (5–8 mots) et moyennes (9–14 mots)\n- Utilise des contextes variés : lieu, direction, temps, manière\n- Ne jamais utiliser les formes contractées du/au/des/aux à la place des prépositions cibles\n\nRetourne uniquement le texte français, rien d'autre.`,
    }
  }

  // G19: насмотренность — natural French text, targets determined client-side by word length
  if (group_id === 'g19') {
    return {
      system: `Tu es un générateur de textes pédagogiques en français pour l'apprentissage de la lecture.`,
      user: `Écris un texte en français de 100 à 150 mots. Ton chaud et motivant. Uniquement des phrases déclaratives. Pas de sujets négatifs. Vocabulaire varié avec des mots de différentes longueurs. Retourne uniquement le texte français, rien d'autre.`,
    }
  }

  // G20: смысловые блоки — ~150-word narrative optimised for syntagmatic chunking
  if (group_id === 'g20') {
    return {
      system: `Tu es un générateur de textes pédagogiques en français pour l'apprentissage de la lecture par syntagmes.`,
      user: `Écris un texte narratif en français de 130 à 150 mots. Règles strictes : uniquement des phrases déclaratives (pas de ? ni de !). Structure syntaxique claire : sujet + verbe + complément. Alterne phrases courtes (5–8 mots) et phrases moyennes (9–14 mots) pour un bon rythme. Utilise beaucoup de virgules pour marquer les pauses naturelles. Ton motivant et chaleureux. Pas de listes, pas de tirets. Pas de sujets négatifs. Retourne uniquement le texte français, rien d'autre.`,
    }
  }

  const positionRule = group_id === 'g1'
    ? `La lettre «${target}» doit apparaître au moins 12 fois, UNIQUEMENT dans des positions prononcées (jamais muette en fin de mot comme -e, -es, -ent, -s, -t, -d, -p, -x, -z muets).`
    : `La combinaison «${target}» doit apparaître au moins 12 fois, UNIQUEMENT en position initiale ou médiane dans les mots. Jamais en fin de mot.`

  const system = `Tu es un générateur de textes pédagogiques pour l'apprentissage du français. Tu utilises ton espace de réflexion pour: 1) lister des mots français contenant «${target}» dans la bonne position, 2) planifier le texte avec ces mots, 3) compter les occurrences, 4) corriger si nécessaire. Tu ne retournes JAMAIS un texte avec moins de 12 occurrences de l'élément cible.`

  const user = `Écris un texte en français de 90 à 110 mots.

Règles:
- Ton chaud et motivant, phrases déclaratives uniquement.
- Pas de sujets négatifs (stress, erreurs, conflits, maladies).
- ${positionRule}
- Retourne uniquement le texte final, rien d'autre.

Thème (choisir un): la nature, le café parisien, une promenade, la lumière du matin, les livres, la musique douce.`

  return { system, user }
}
