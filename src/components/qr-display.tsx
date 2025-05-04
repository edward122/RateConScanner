"use client"

import { useEffect, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, QrCode } from "lucide-react"

const BASE_URL = "https://9000-idx-studio-1746197190102.cluster-pb4ljhlmg5hqsxnzpc56r3prxw.cloudworkstations.dev"

export function QRDisplay({ className }: { className?: string }) {
  const [connectionId, setConnectionId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [qrUrl, setQrUrl] = useState<string>("")
  const [showPopover, setShowPopover] = useState(false)

  useEffect(() => {
    const id = Math.random().toString(36).substring(2, 15)
    const mobileUrl = `${BASE_URL}/mobile?id=${id}`
    setConnectionId(id)
    setQrUrl(mobileUrl)
    setIsLoading(false)
  }, [])

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
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 dark:bg-black/60 shadow border border-border text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
          aria-label="Show QR code to connect your phone"
        >
          <QrCode className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          Connect Your Phone?
        </button>
        {showPopover && (
          <div className="absolute left-0 mt-2 w-80 max-w-xs bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-border p-4 animate-fadein flex flex-col items-center z-50"
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