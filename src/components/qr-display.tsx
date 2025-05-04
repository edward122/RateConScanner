"use client"

import { useEffect, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, QrCode } from "lucide-react"

const BASE_URL = "https://9000-idx-studio-1746197190102.cluster-pb4ljhlmg5hqsxnzpc56r3prxw.cloudworkstations.dev"

export function QRDisplay({ className, sessionId }: { className?: string, sessionId?: string }) {
  const [connectionId, setConnectionId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [qrUrl, setQrUrl] = useState<string>("")
  const [showPopover, setShowPopover] = useState(false)

  useEffect(() => {
    let id = sessionId
    if (!id) {
      id = Math.random().toString(36).substring(2, 15)
    }
    const mobileUrl = `${BASE_URL}/mobile?id=${id}`
    setConnectionId(id)
    setQrUrl(mobileUrl)
    setIsLoading(false)
  }, [sessionId])

  return (
    <div className={cn("fixed top-4 left-4 z-50", className)}>
      <div
        className="group relative"
        onMouseEnter={() => setShowPopover(true)}
        onMouseLeave={() => setShowPopover(false)}
        onClick={() => setShowPopover(v => !v)}
        tabIndex={0}
        onFocus={() => setShowPopover(true)}
        onBlur={() => setShowPopover(false)}
        style={{ outline: "none" }}
      >
        
        {showPopover && (
          <div className="absolute -left-40 -top-5 mt-2 w-80 max-w-xs bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-border p-4 animate-fadein flex flex-col items-center z-50"
            style={{ minWidth: 280 }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <QRCodeCanvas
                  value={qrUrl}
                  size={180}
                  level="H"
                  includeMargin={true}
                  className="w-full h-full mb-2 rounded-lg bg-white"
                />
                <div className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground">
                    Scan with your phone's camera
                  </p>
                  <p className="text-xs text-muted-foreground/80">
                    Connection ID: <span className="font-mono">{connectionId}</span>
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 