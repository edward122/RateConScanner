"use client"

import { useState } from "react"
import { QRScanner } from "@/components/qr-scanner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Camera, Loader2 } from "lucide-react"

export default function MobilePage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  const handleScan = (connectionId: string) => {
    // TODO: Implement WebSocket connection
    console.log("Connected with ID:", connectionId)
    setIsConnected(true)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        {!isConnected ? (
          <QRScanner onScan={handleScan} />
        ) : (
          <Card className="glass hover-lift">
            <CardHeader>
              <CardTitle>Camera Ready</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Button
                onClick={() => setIsScanning(!isScanning)}
                className="w-full"
                size="lg"
              >
                <Camera className="w-4 h-4 mr-2" />
                {isScanning ? "Stop Scanning" : "Start Scanning"}
              </Button>
              {isScanning && (
                <div className="w-full aspect-square relative overflow-hidden rounded-lg">
                  {/* TODO: Implement camera preview and capture */}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 