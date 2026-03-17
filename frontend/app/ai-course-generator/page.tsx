'use client'

import { useState } from 'react'
import { api } from "@/lib/api"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Sparkles, 
  BookOpen, 
  Clock, 
  Users, 
  Target,
  CheckCircle2,
  Play,
  FileText,
  HelpCircle,
  MessageSquare,
  ClipboardList,
  ChevronRight,
  Loader2,
  Copy,
  Download,
  RefreshCw
} from "lucide-react"

interface Lesson {
  title: string
  type: 'video' | 'reading' | 'quiz' | 'assignment' | 'discussion'
  duration: string
  description: string
}

interface Module {
  title: string
  description: string
  duration: string
  lessons: Lesson[]
}

interface Course {
  title: string
  description: string
  objectives: string[]
  targetAudience: string
  prerequisites: string[]
  estimatedDuration: string
  difficulty: 'pemula' | 'menengah' | 'lanjutan'
  modules: Module[]
}

const lessonTypeIcons = {
  video: Play,
  reading: FileText,
  quiz: HelpCircle,
  assignment: ClipboardList,
  discussion: MessageSquare,
}

const lessonTypeLabels = {
  video: 'Video',
  reading: 'Bacaan',
  quiz: 'Kuis',
  assignment: 'Tugas',
  discussion: 'Diskusi',
}

export default function AICourseGeneratorPage() {
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState('menengah')
  const [duration, setDuration] = useState('4-minggu')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCourse, setGeneratedCourse] = useState<Course | null>(null)
  const [expandedModules, setExpandedModules] = useState<number[]>([0])
  const [streamingText, setStreamingText] = useState('')

  const [exporting, setExporting] = useState(false)

  const handleGenerate = async () => {
    if (!topic.trim()) return
    
    setIsGenerating(true)
    setGeneratedCourse(null)
    setStreamingText('')

    try {
      // The backend expects a simple text prompt
      const prompt = `Create a course about "${topic}". Level: ${level}, Duration: ${duration}. ${additionalNotes ? `Additional notes: ${additionalNotes}` : ''}`
      
      const data = await api.generateCourseOutline(prompt)

      if (data.course) {
        setGeneratedCourse(data.course)
        setStreamingText(JSON.stringify(data.course, null, 2))
      }
    } catch (error: any) {
      console.error('Error generating course:', error)
      setStreamingText(error.message || 'Gagal menghasilkan kursus. Pastikan API key sudah dikonfigurasi.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExport = async () => {
    if (!generatedCourse) return

    setExporting(true)
    try {
      const blob = await api.exportCourseMBZ(generatedCourse)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `moodle-target-course.mbz`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to export MBZ", error)
    } finally {
      setExporting(false)
    }
  }

  const toggleModule = (index: number) => {
    setExpandedModules(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const copyToClipboard = () => {
    if (generatedCourse) {
      navigator.clipboard.writeText(JSON.stringify(generatedCourse, null, 2))
    }
  }

  const difficultyColors = {
    pemula: 'bg-green-500/10 text-green-500 border-green-500/20',
    menengah: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    lanjutan: 'bg-red-500/10 text-red-500 border-red-500/20',
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Didukung oleh AI</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              AI Course Generator
            </h1>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Buat struktur kursus Moodle lengkap dalam hitungan detik dengan kekuatan AI. 
              Cukup masukkan topik dan preferensi Anda, AI akan menghasilkan kursus yang terstruktur.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-5">
            {/* Input Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Konfigurasi Kursus</h2>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="topic">Topik Kursus *</Label>
                    <Input
                      id="topic"
                      placeholder="Contoh: Dasar-dasar Python untuk Data Science"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="level">Level Kesulitan</Label>
                    <Select value={level} onValueChange={setLevel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pemula">Pemula</SelectItem>
                        <SelectItem value="menengah">Menengah</SelectItem>
                        <SelectItem value="lanjutan">Lanjutan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Durasi Kursus</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-minggu">1 Minggu</SelectItem>
                        <SelectItem value="2-minggu">2 Minggu</SelectItem>
                        <SelectItem value="4-minggu">4 Minggu</SelectItem>
                        <SelectItem value="8-minggu">8 Minggu</SelectItem>
                        <SelectItem value="12-minggu">12 Minggu (1 Semester)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Catatan Tambahan (Opsional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Tambahkan instruksi khusus, fokus materi tertentu, atau preferensi lainnya..."
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleGenerate}
                    disabled={isGenerating || !topic.trim()}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sedang Membuat...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Kursus
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              {/* Tips */}
              <Card className="p-6 bg-muted/50">
                <h3 className="font-medium mb-3">Tips untuk hasil terbaik:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    Gunakan topik yang spesifik dan jelas
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    Sesuaikan level dengan target audiens
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    Tambahkan catatan untuk fokus materi tertentu
                  </li>
                </ul>
              </Card>
            </div>

            {/* Generated Course Preview */}
            <div className="lg:col-span-3">
              {isGenerating && !generatedCourse && (
                <Card className="p-8">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full border-4 border-muted animate-pulse" />
                      <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium">AI sedang membuat kursus...</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                      Mohon tunggu sebentar, AI sedang menyusun struktur kursus yang optimal untuk topik Anda.
                    </p>
                    {streamingText && (
                      <div className="mt-4 w-full max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {streamingText.slice(0, 500)}...
                        </pre>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {generatedCourse && (
                <div className="space-y-6">
                  {/* Course Header */}
                  <Card className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={difficultyColors[generatedCourse.difficulty]}>
                            {generatedCourse.difficulty.charAt(0).toUpperCase() + generatedCourse.difficulty.slice(1)}
                          </Badge>
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            <Clock className="mr-1 h-3 w-3" />
                            {generatedCourse.estimatedDuration}
                          </Badge>
                        </div>
                        <h2 className="text-2xl font-bold">{generatedCourse.title}</h2>
                        <p className="mt-2 text-muted-foreground">{generatedCourse.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={copyToClipboard}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleExport} disabled={exporting}>
                          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleGenerate}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Course Meta */}
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <div className="flex items-start gap-3">
                        <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Target Audiens</p>
                          <p className="text-sm text-muted-foreground">{generatedCourse.targetAudience}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Prasyarat</p>
                          <p className="text-sm text-muted-foreground">
                            {generatedCourse.prerequisites.length > 0 
                              ? generatedCourse.prerequisites.join(', ')
                              : 'Tidak ada prasyarat khusus'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Objectives */}
                    <div className="mt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">Tujuan Pembelajaran</h3>
                      </div>
                      <ul className="space-y-2">
                        {generatedCourse.objectives.map((objective, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            {objective}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>

                  {/* Modules */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">
                      Struktur Kursus ({generatedCourse.modules.length} Modul)
                    </h3>
                    
                    {generatedCourse.modules.map((module, moduleIdx) => (
                      <Card key={moduleIdx} className="overflow-hidden">
                        <button
                          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                          onClick={() => toggleModule(moduleIdx)}
                        >
                          <div className="flex items-center gap-3 text-left">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                              {moduleIdx + 1}
                            </div>
                            <div>
                              <h4 className="font-medium">{module.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {module.lessons.length} pelajaran • {module.duration}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${
                            expandedModules.includes(moduleIdx) ? 'rotate-90' : ''
                          }`} />
                        </button>
                        
                        {expandedModules.includes(moduleIdx) && (
                          <div className="border-t border-border px-4 py-3 bg-muted/30">
                            <p className="text-sm text-muted-foreground mb-4">{module.description}</p>
                            <div className="space-y-2">
                              {module.lessons.map((lesson, lessonIdx) => {
                                const Icon = lessonTypeIcons[lesson.type]
                                return (
                                  <div 
                                    key={lessonIdx}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border"
                                  >
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                      <Icon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{lesson.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {lessonTypeLabels[lesson.type]} • {lesson.duration}
                                      </p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={handleExport} disabled={exporting}>
                      {exporting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Export MBZ (Download)
                    </Button>
                  </div>
                </div>
              )}

              {!isGenerating && !generatedCourse && (
                <Card className="p-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">Belum ada kursus</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                      Isi form di sebelah kiri dan klik "Generate Kursus" untuk membuat struktur kursus dengan AI.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
