"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { ref, push, set } from "firebase/database"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Camera, Loader2, Trash2, Send, X, Image as ImageIcon, Sun, Moon, RotateCcw } from "lucide-react"
import { v4 as uuidv4 } from 'uuid';

export default function MobilePage() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aspect, setAspect] = useState<'vertical' | 'horizontal'>('vertical');
  const [flashOn, setFlashOn] = useState(false)
  const [showPreviewIdx, setShowPreviewIdx] = useState<number | null>(null)
  const [photoLimit] = useState(10)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()

  // Get session id from URL
  useEffect(() => {
    const id = searchParams.get("id")
    if (id) setSessionId(id)
  }, [searchParams])

  // Start camera
  const startCamera = async () => {
    setError(null)
    setCameraActive(true)
    setIsFullscreen(true)
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        }
      }
      // Flash/torch support
      if (flashOn) {
        (constraints.video as any).torch = true
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (err) {
      setError("Failed to access camera")
      setCameraActive(false)
      setIsFullscreen(false)
    }
  }

  // Stop camera
  const stopCamera = () => {
    setCameraActive(false)
    setIsFullscreen(false)
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
  }

  // Toggle flash (if supported)
  const toggleFlash = async () => {
    setFlashOn(f => !f)
    if (videoRef.current && videoRef.current.srcObject) {
      const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0]
      // @ts-ignore
      if (track && track.getCapabilities && track.getCapabilities().torch) {
        // @ts-ignore
        await track.applyConstraints({ advanced: [{ torch: !flashOn }] })
      }
    }
  }

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
      setPhotos(prev => [...prev, dataUrl])
    }
  }

  // Gallery import
  const handleGalleryImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = event => {
        if (typeof event.target?.result === 'string') {
          setPhotos(prev => [...prev, event.target!.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  // Send all photos to Firebase
  const sendPhotos = async () => {
    if (!sessionId || photos.length === 0) return
    setIsSending(true)
    const rateConId = Date.now().toString()
    const rateConRef = ref(db, `/sessions/${sessionId}/ratecons/${rateConId}`)
    await set(rateConRef, {
      photos,
      createdAt: Date.now(),
    })
    setIsSending(false)
    setPhotos([])
    stopCamera()
    alert("Photos sent!")
  }

  // Remove a photo
  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  // Retake/replace last photo
  const retakeLastPhoto = () => {
    setPhotos(prev => prev.slice(0, -1))
    setShowPreviewIdx(null)
  }

  // Accessibility: focus trap for fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isFullscreen])

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-black flex flex-col" : "container mx-auto px-4 py-8"}>
      <div className={isFullscreen ? "flex-1 flex flex-col items-center justify-center" : "max-w-md mx-auto"}>
        {sessionId ? (
          <Card className={isFullscreen ? "w-full h-full bg-black border-none shadow-none" : "glass hover-lift"}>
            <CardHeader className={isFullscreen ? "flex flex-row items-center justify-between bg-black text-white" : undefined}>
              <CardTitle>{isFullscreen ? "Camera" : "Take Rate Con Photos"}</CardTitle>
              {isFullscreen && (
                <Button size="icon" variant="ghost" aria-label="Close camera" onClick={stopCamera}>
                  <X className="w-6 h-6" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {!cameraActive ? (
                <div className="w-full flex flex-col gap-2">
                  <Button onClick={startCamera} className="w-full" size="lg">
                    <Camera className="w-4 h-4 mr-2" /> Start Camera
                  </Button>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                    size="lg"
                    variant="outline"
                  >
                    <ImageIcon className="w-4 h-4 mr-2" /> Import from Gallery
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleGalleryImport}
                  />
                </div>
              ) : (
                <div className="w-full flex flex-col items-center gap-2">
                  <div className="flex w-full justify-between mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAspect(a => a === 'vertical' ? 'horizontal' : 'vertical')}
                    >
                      {aspect === 'vertical' ? 'Switch to Horizontal' : 'Switch to Vertical'}
                    </Button>
                    <Button
                      size="sm"
                      variant={flashOn ? "default" : "outline"}
                      onClick={toggleFlash}
                      aria-label="Toggle Flash"
                    >
                      {flashOn ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className={`w-full max-w-xs ${aspect === 'vertical' ? 'aspect-[9/16]' : 'aspect-[16/9]'} bg-black rounded-lg overflow-hidden flex items-center justify-center`}>
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted tabIndex={0} aria-label="Camera preview" />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2 w-full">
                    <Button onClick={capturePhoto} className="flex-1" size="lg" disabled={photos.length >= photoLimit} aria-label="Capture photo">
                      <Camera className="w-4 h-4 mr-2" /> Capture
                    </Button>
                    <Button onClick={stopCamera} className="flex-1" size="lg" variant="destructive" aria-label="Stop camera">
                      Stop
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{photos.length} / {photoLimit} photos</div>
                </div>
              )}
              {error && <div className="text-red-500 text-sm">{error}</div>}
              {photos.length > 0 && (
                <div className="w-full mt-4">
                  <div className="flex flex-wrap gap-2 justify-center">
                    {photos.map((photo, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={photo}
                          alt={`Photo ${idx + 1}`}
                          className={aspect === 'vertical' ? 'w-20 h-32 object-cover rounded shadow cursor-pointer' : 'w-32 h-20 object-cover rounded shadow cursor-pointer'}
                          onClick={() => setShowPreviewIdx(idx)}
                          tabIndex={0}
                          aria-label={`Preview photo ${idx + 1}`}
                        />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow opacity-80 group-hover:opacity-100"
                          aria-label={`Delete photo ${idx + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {idx === photos.length - 1 && (
                          <button
                            onClick={retakeLastPhoto}
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-white rounded-full p-1 shadow opacity-80 group-hover:opacity-100"
                            aria-label="Retake last photo"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button onClick={sendPhotos} className="w-full mt-4" size="lg" disabled={isSending || photos.length === 0} aria-label="Send to Desktop">
                    <Send className="w-4 h-4 mr-2" /> {isSending ? "Sending..." : "Send to Desktop"}
                  </Button>
                </div>
              )}
              {/* Fullscreen photo preview */}
              {showPreviewIdx !== null && (
                <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center" onClick={() => setShowPreviewIdx(null)}>
                  <img src={photos[showPreviewIdx]} alt={`Preview ${showPreviewIdx + 1}`} className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-lg" />
                  <Button size="icon" variant="ghost" className="absolute top-4 right-4" onClick={() => setShowPreviewIdx(null)} aria-label="Close preview">
                    <X className="w-8 h-8 text-white" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="glass hover-lift">
            <CardHeader>
              <CardTitle>Waiting for Session ID...</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 