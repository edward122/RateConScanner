"use client"

import { useState, useRef, useEffect } from "react"
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Camera, Loader2 } from "lucide-react"

interface QRScannerProps {
  className?: string
  onScan: (data: string) => void
}

export function QRScanner({ className, onScan }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)

  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop()
      }
    }
  }, [])

  const startScanning = async () => {
    try {
      const codeReader = new BrowserQRCodeReader()
      const videoInputDevices = await BrowserQRCodeReader.listVideoInputDevices()
      
      if (videoInputDevices.length === 0) {
        throw new Error("No video input devices found")
      }

      const controls = await codeReader.decodeFromVideoDevice(
        videoInputDevices[0].deviceId,
        videoRef.current!,
        (result, error) => {
          if (result) {
            onScan(result.getText())
            setIsScanning(false)
            controls.stop()
          }
          if (error) {
            console.error(error)
          }
        }
      )

      controlsRef.current = controls
      setIsScanning(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to access camera")
      setIsScanning(false)
    }
  }

  const stopScanning = () => {
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }
    setIsScanning(false)
  }

  return (
    <Card className={cn("glass hover-lift", className)}>
      <CardHeader>
        <CardTitle>Scan QR Code</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {!isScanning ? (
          <Button
            onClick={startScanning}
            className="w-full"
            size="lg"
          >
            <Camera className="w-4 h-4 mr-2" />
            Start Scanning
          </Button>
        ) : (
          <div className="w-full aspect-square relative overflow-hidden rounded-lg">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 border-4 border-primary rounded-lg pointer-events-none" />
            <Button
              onClick={stopScanning}
              className="absolute top-2 right-2"
              variant="destructive"
              size="sm"
            >
              Stop
            </Button>
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </CardContent>
    </Card>
  )
} 