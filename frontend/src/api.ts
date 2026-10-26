export type Detection = {
  class_id?: number
  class_name: string
  confidence: number
  box?: number[]
  bbox?: number[]
  label?: string
}

export type SafetyAssessment = {
  status: 'potential_violation' | 'no_supported_violation_detected' | 'unsupported' | string
  requires_human_review?: boolean
  rule_version?: string
  violations?: string[]
  notes?: string[]
}

export type Inspection = {
  id?: string | number
  inspection_id?: string
  timestamp?: string
  created_at?: string
  source?: string
  detections?: Detection[]
  detected_objects?: number
  potential_violations?: number
  violation_count?: number
  safety_assessment?: SafetyAssessment
  model_version?: string
}

export type ImageDetectionResponse = {
  inspection_id?: string
  annotated_image?: string
  image?: string
  detections?: Detection[]
  object_count?: number
  total_objects?: number
  potential_violations?: number
  safety_assessment?: SafetyAssessment | string
  model_version?: string
  history_stored?: boolean
  created_at?: string
}

export type HealthResponse = {
  status: 'ok' | 'degraded' | string
  model_loaded: boolean
  model_version?: string | null
  model_error?: string | null
  database_connected?: boolean
  auth_mode?: string
  message?: string
}

export type VideoJobResponse = {
  job_id: string
  inspection_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  frames_processed: number
  total_frames: number
  error?: string | null
  result_url?: string | null
}

export type InspectionListResponse = {
  items: Inspection[]
  limit: number
  skip: number
  total: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || 'http://localhost:8080'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new Error(`Unable to reach the SafeSight backend at ${API_URL}. Ensure the FastAPI server is running on port 8080.`)
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`
    try {
      const errorJson = await response.json()
      if (errorJson?.error?.message) {
        errorMessage = errorJson.error.message
      } else if (errorJson?.detail) {
        errorMessage = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail)
      }
    } catch {
      const text = await response.text().catch(() => '')
      if (text) errorMessage = text
    }
    throw new Error(errorMessage)
  }

  return response.json() as Promise<T>
}

export const api = {
  apiUrl: API_URL,

  health: () => request<HealthResponse>('/api/health'),

  detections: async (): Promise<Inspection[]> => {
    try {
      const result = await request<Record<string, unknown> | Inspection[]>('/api/detections')
      if (Array.isArray(result)) return result
      const list = ((result.items || result.detections || result.records || []) as Inspection[])
      return list.map((item: Inspection) => ({
        ...item,
        id: item.inspection_id || item.id,
        timestamp: item.created_at || item.timestamp,
        detected_objects: item.detections?.length ?? item.detected_objects ?? 0,
        potential_violations:
          typeof item.safety_assessment === 'object' && item.safety_assessment?.violations
            ? item.safety_assessment.violations.length
            : item.potential_violations ?? 0,
      }))
    } catch {
      // If MongoDB is not configured or history fails in local development, return empty list gracefully
      return []
    }
  },

  detectImage: async (file: File, confidence: number = 0.5, storeHistory: boolean = false): Promise<ImageDetectionResponse> => {
    const form = new FormData()
    form.append('file', file)
    const clampedConfidence = Math.min(Math.max(confidence, 0.05), 0.95)
    const params = new URLSearchParams({
      confidence: String(clampedConfidence),
      store_history: String(storeHistory),
    })

    const res = await request<ImageDetectionResponse>(`/api/detect/image?${params.toString()}`, {
      method: 'POST',
      body: form,
    })

    const violationsCount =
      typeof res.safety_assessment === 'object' && res.safety_assessment?.violations
        ? res.safety_assessment.violations.length
        : 0

    return {
      ...res,
      object_count: res.total_objects ?? res.detections?.length ?? 0,
      potential_violations: violationsCount,
    }
  },

  startVideoJob: async (file: File, confidence: number = 0.25): Promise<VideoJobResponse> => {
    const form = new FormData()
    form.append('file', file)
    const clampedConfidence = Math.min(Math.max(confidence, 0.05), 0.95)
    const params = new URLSearchParams({
      confidence: String(clampedConfidence),
      store_history: 'false',
    })
    return request<VideoJobResponse>(`/api/detect/video?${params.toString()}`, {
      method: 'POST',
      body: form,
    })
  },

  getVideoJob: (jobId: string): Promise<VideoJobResponse> => {
    return request<VideoJobResponse>(`/api/jobs/${jobId}`)
  },

  getVideoResultBlob: async (jobId: string): Promise<Blob> => {
    const response = await fetch(`${API_URL}/api/jobs/${jobId}/result`)
    if (!response.ok) {
      throw new Error(`Failed to download video result (${response.status})`)
    }
    return response.blob()
  },

  detectVideo: async (file: File, onProgress?: (job: VideoJobResponse) => void): Promise<Blob> => {
    const initial = await api.startVideoJob(file)
    if (onProgress) onProgress(initial)

    const jobId = initial.job_id
    // Poll job status until completed or failed
    const maxPolls = 300 // up to 5 minutes with 1s intervals
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      const status = await api.getVideoJob(jobId)
      if (onProgress) onProgress(status)

      if (status.status === 'completed') {
        return api.getVideoResultBlob(jobId)
      }
      if (status.status === 'failed') {
        throw new Error(status.error || 'Video detection processing failed.')
      }
    }
    throw new Error('Video processing timed out.')
  },

  annotatedImageUrl: (result: ImageDetectionResponse) => result.annotated_image || result.image || '',
}
