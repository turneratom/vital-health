import { useState, useCallback, useRef } from 'react'
import { useAction, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { classifyAllMarkers, type ClassifiedMarker } from '@/lib/LabResultParser'

/* ═══════════════════════════════════════════════════════════════
   useRapidIntake — Single-text-area AI onboarding hook
   
   Manages the entire flow:
   1. User types or dictates a natural-language bio description
   2. AI Brain parses age, weight, supplements, biomarkers
   3. Results are saved to BioVault + UserVitals
   4. Returns structured data for instant HUD population
   
   States: idle → parsing → populating → complete | error
   ═══════════════════════════════════════════════════════════════ */

export type RapidIntakeStatus = 'idle' | 'listening' | 'parsing' | 'populating' | 'complete' | 'error'

export interface RapidIntakeResult {
  chronoAge: number
  bioAge: number
  delta: number
  status: string
  confidence: number
  markersAnalyzed: number
  classifiedMarkers: ClassifiedMarker[]
  northStar: { goal: string; confidence: number; reason: string }
  topInsights: string[]
  supplements: string[]
  vitals: { age: number | null; gender: string | null; weight: number | null; unit: string }
  dataQuality: string
  source: 'ai' | 'local'
}

export interface ParseStage {
  label: string
  icon: string
  active: boolean
  complete: boolean
}

const PLACEHOLDER_EXAMPLES = [
  "I'm 34, male, 180lbs. I take 5mg Creatine, 250mg NMN, and 5000IU Vitamin D daily. My last labs showed Vitamin D at 42, HbA1c 5.4%, Testosterone 650 ng/dL, ferritin 85.",
  "32 year old female, 135lbs. Currently taking Magnesium Glycinate 400mg, Omega-3 2g, and Ashwagandha 600mg. Sleep about 7 hours. Focus on longevity.",
  "Age 28, male, 195lbs. Supplements: Creatine 5g, Whey Protein, Zinc 30mg, B-Complex. Recent bloodwork: CRP 0.8, fasting glucose 88, free testosterone 18 pg/mL.",
]

export function useRapidIntake() {
  const [status, setStatus] = useState<RapidIntakeStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RapidIntakeResult | null>(null)
  const [parseStages, setParseStages] = useState<ParseStage[]>([])
  const [inputText, setInputText] = useState('')
  const recognitionRef = useRef<any>(null)
  const [isListening, setIsListening] = useState(false)

  const instantParse = useAction(api.instantOnboard.instantParse)
  const saveBioVault = useMutation(api.mutations.upsertBioVault)
  const saveVitals = useMutation(api.mutations.upsertUserVitals)

  // Get a random placeholder example
  const placeholder = PLACEHOLDER_EXAMPLES[Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length)]

  // Voice-to-text using Web Speech API
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser. Please type your info instead.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      setStatus('listening')
      setError(null)
    }

    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInputText(transcript)
    }

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        setError(`Voice recognition error: ${event.error}`)
      }
      setIsListening(false)
      setStatus('idle')
    }

    recognition.onend = () => {
      setIsListening(false)
      if (status === 'listening') setStatus('idle')
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [status])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
    if (status === 'listening') setStatus('idle')
  }, [status])

  // Main parse function
  const parseInput = useCallback(async (text?: string) => {
    const rawText = (text || inputText).trim()
    if (!rawText || rawText.length < 10) {
      setError('Please describe yourself in a bit more detail — age, weight, supplements, or lab values.')
      return
    }

    setError(null)
    setStatus('parsing')

    // Animate parse stages
    const stages: ParseStage[] = [
      { label: 'Extracting vitals', icon: '🫀', active: true, complete: false },
      { label: 'Identifying supplements', icon: '💊', active: false, complete: false },
      { label: 'Parsing biomarkers', icon: '🧬', active: false, complete: false },
      { label: 'Computing bio-age', icon: '⚡', active: false, complete: false },
      { label: 'Generating insights', icon: '🎯', active: false, complete: false },
    ]
    setParseStages([...stages])

    // Animate through stages
    const advanceStage = (index: number) => {
      setParseStages(prev => prev.map((s, i) => ({
        ...s,
        active: i === index + 1,
        complete: i <= index,
      })))
    }

    const stageTimers = stages.map((_, i) =>
      setTimeout(() => advanceStage(i), 800 + i * 1200)
    )

    try {
      const sessionId = localStorage.getItem('vive-session-id') || 'guest-user'

      // Call AI Brain
      const aiResult = await instantParse({ rawText, inputType: 'free_text' })

      if (!aiResult.success) {
        stageTimers.forEach(clearTimeout)
        setError('Failed to parse your input. Please try again with more detail.')
        setStatus('error')
        return
      }

      const data = aiResult.data
      setStatus('populating')

      // Complete all stages
      setParseStages(prev => prev.map(s => ({ ...s, active: false, complete: true })))

      // Save to BioVault
      const biomarkers = data.biomarkers || {}
      try {
        await saveBioVault({
          sessionId,
          vitaminD: biomarkers.vitaminD ?? undefined,
          testosteroneFree: biomarkers.testosteroneFree ?? undefined,
          testosteroneTotal: biomarkers.testosteroneTotal ?? undefined,
          ferritin: biomarkers.ferritin ?? undefined,
          crp: biomarkers.crp ?? undefined,
          hba1c: biomarkers.hba1c ?? undefined,
          fastingGlucose: biomarkers.fastingGlucose ?? undefined,
          mthfrVariant: data.geneticFlags?.mthfrVariant ?? false,
          apoe4: data.geneticFlags?.apoe4 ?? false,
          caffeineSensitivity: data.geneticFlags?.caffeineSensitivity ?? false,
          preferredProteins: data.diet?.preferredProteins ?? 'chicken, fish, eggs',
          dietaryRestrictions: data.diet?.dietaryRestrictions ?? 'none',
        })
      } catch (e) {
        console.warn('[RapidIntake] BioVault save failed:', e)
      }

      // Save vitals
      const vitals = data.vitals || {}
      if (vitals.age) {
        try {
          await saveVitals({
            sessionId,
            age: vitals.age,
            gender: vitals.gender || 'male',
            weight: vitals.weight || 170,
            unit: vitals.weightUnit === 'kg' ? 'kg' : 'lbs',
          })
        } catch (e) {
          console.warn('[RapidIntake] Vitals save failed:', e)
        }
      }

      // Classify biomarkers
      const allBiomarkers: Record<string, number | null> = { ...biomarkers }
      if (data.additionalBiomarkers) {
        for (const ab of data.additionalBiomarkers) {
          const key = ab.name.toLowerCase().replace(/[\s\-()]/g, '')
          allBiomarkers[key] = ab.value
        }
      }

      const classified = classifyAllMarkers(allBiomarkers)
      const chronoAge = vitals.age || 35

      // Compute biological age
      let bioAgeOffset = 0
      let markerCount = 0
      for (const m of classified.all) {
        if (m.classification === 'optimal') { bioAgeOffset -= 0.5; markerCount++ }
        else if (m.classification === 'clinically-normal') { bioAgeOffset += 0.8; markerCount++ }
        else if (m.classification === 'out-of-range') { bioAgeOffset += 2.0; markerCount++ }
      }
      if (markerCount > 0) bioAgeOffset = bioAgeOffset / Math.sqrt(markerCount)

      // Supplement bonus (taking supplements = proactive)
      const supplementCount = (data.supplements || []).length
      bioAgeOffset -= Math.min(supplementCount * 0.15, 1.5)

      const bioAge = Math.round((chronoAge + bioAgeOffset) * 10) / 10
      const delta = Math.round((bioAge - chronoAge) * 10) / 10

      // Generate insights
      const topInsights: string[] = []
      for (const m of classified.outOfRange.slice(0, 2)) {
        topInsights.push(m.suggestion)
      }
      for (const m of classified.subOptimal.slice(0, 3 - topInsights.length)) {
        topInsights.push(m.suggestion)
      }
      if (topInsights.length === 0 && supplementCount > 0) {
        topInsights.push(`${supplementCount} active supplements detected. Protocol stack is being optimized.`)
      }

      let statusLabel: string
      if (delta <= -5) statusLabel = 'Exceptional'
      else if (delta <= -2) statusLabel = 'Optimized'
      else if (delta <= 0) statusLabel = 'On Track'
      else if (delta <= 3) statusLabel = 'Needs Attention'
      else statusLabel = 'Accelerated Aging'

      const confidence = Math.min(95, Math.max(30, 40 + markerCount * 5 + supplementCount * 3))

      const finalResult: RapidIntakeResult = {
        chronoAge,
        bioAge,
        delta,
        status: statusLabel,
        confidence,
        markersAnalyzed: markerCount,
        classifiedMarkers: classified.all,
        northStar: data.northStar || { goal: 'longevity', confidence: 0.5, reason: 'Default optimization path.' },
        topInsights,
        supplements: data.supplements || [],
        vitals: {
          age: vitals.age || null,
          gender: vitals.gender || null,
          weight: vitals.weight || null,
          unit: vitals.weightUnit === 'kg' ? 'kg' : 'lbs',
        },
        dataQuality: data.dataQuality?.level || 'medium',
        source: aiResult.source,
      }

      setResult(finalResult)

      // Brief delay for the populating animation
      await new Promise(resolve => setTimeout(resolve, 800))
      setStatus('complete')
    } catch (err: any) {
      console.error('[RapidIntake] Parse failed:', err)
      setError(err?.message || 'Analysis failed. Please try again.')
      setStatus('error')
    }
  }, [inputText, instantParse, saveBioVault, saveVitals])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setResult(null)
    setParseStages([])
    setInputText('')
    stopListening()
  }, [stopListening])

  return {
    status,
    error,
    result,
    parseStages,
    inputText,
    setInputText,
    placeholder,
    isListening,
    startListening,
    stopListening,
    parseInput,
    reset,
  }
}
