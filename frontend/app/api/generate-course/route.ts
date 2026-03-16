import { generateText, Output } from 'ai'
import { z } from 'zod'

const moduleSchema = z.object({
  title: z.string(),
  description: z.string(),
  duration: z.string(),
  lessons: z.array(z.object({
    title: z.string(),
    type: z.enum(['video', 'reading', 'quiz', 'assignment', 'discussion']),
    duration: z.string(),
    description: z.string(),
  })),
})

const courseSchema = z.object({
  title: z.string(),
  description: z.string(),
  objectives: z.array(z.string()),
  targetAudience: z.string(),
  prerequisites: z.array(z.string()),
  estimatedDuration: z.string(),
  difficulty: z.enum(['pemula', 'menengah', 'lanjutan']),
  modules: z.array(moduleSchema),
})

export async function POST(req: Request) {
  try {
    const { topic, level, duration, language, additionalNotes } = await req.json()

    const prompt = `Buatkan struktur kursus Moodle yang lengkap dan terperinci dalam bahasa Indonesia untuk topik berikut:

Topik: ${topic}
Level: ${level}
Durasi: ${duration}
Bahasa: ${language || 'Indonesia'}
${additionalNotes ? `Catatan tambahan: ${additionalNotes}` : ''}

Buatkan kursus dengan:
- Judul yang menarik dan deskriptif
- Deskripsi lengkap tentang kursus
- 3-5 tujuan pembelajaran yang jelas
- Target audiens yang spesifik
- Prasyarat yang diperlukan (jika ada)
- Estimasi durasi total
- 4-8 modul dengan:
  - Judul modul
  - Deskripsi modul
  - Durasi modul
  - 3-6 pelajaran per modul (variasikan tipe: video, reading, quiz, assignment, discussion)

Pastikan konten relevan, terstruktur dengan baik, dan sesuai dengan standar pendidikan.`

    const result = await generateText({
      model: 'openai/gpt-4o',
      prompt,
      output: Output.object({
        schema: courseSchema,
      }),
    })

    return Response.json({ course: result.output })
  } catch (error) {
    console.error('Error generating course:', error)
    return Response.json(
      { error: 'Gagal menghasilkan kursus. Silakan coba lagi.' },
      { status: 500 }
    )
  }
}
