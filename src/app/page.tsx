'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { extractRateConData, type ExtractRateConDataOutput } from '@/ai/flows/extract-rate-con-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from "@/hooks/use-toast";
import { Upload, Copy, Loader2, GripVertical, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QRDisplay } from "@/components/qr-display"

// Define type for individual address components
type Address = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
};

// Flattened type for editing and ordering
type EditableField =
  | 'loadNumber'
  | 'shipper.name'
  | 'shipper.address'
  | 'shipper.city'
  | 'shipper.state'
  | 'shipper.zipCode'
  | 'shipper.phone'
  | 'consignee.name'
  | 'consignee.address'
  | 'consignee.city'
  | 'consignee.state'
  | 'consignee.zipCode'
  | 'consignee.phone'
  | 'weight'
  | 'amount'
  | 'truckNumber';

// Helper function to get nested value
const getNestedValue = (obj: any, path: string): string => {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return ''; // Return empty string if path doesn't exist or value isn't object
    }
  }
  // Ensure return value is a string, handling null/undefined/non-string primitives
  return String(value ?? '');
};


// Helper function to set nested value
const setNestedValue = (obj: any, path: string, value: string): any => {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    // Ensure parent path exists and is an object
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {}; // Create nested object if it doesn't exist or isn't an object
    }
    current = current[key];
  }
  // Set the final value, handle empty string -> undefined
  current[keys[keys.length - 1]] = value === '' ? undefined : value;
  return { ...obj }; // Return a new object copy for immutability
};


const defaultFieldOrder: EditableField[] = [
  'loadNumber',
  'shipper.name',
  'shipper.address',
  'shipper.city',
  'shipper.state',
  'shipper.zipCode',
  'shipper.phone',
  'consignee.name',
  'consignee.address',
  'consignee.city',
  'consignee.state',
  'consignee.zipCode',
  'consignee.phone',
  'weight',
  'amount',
  'truckNumber',
];

const fieldLabels: Record<EditableField, string> = {
  loadNumber: 'Load #',
  'shipper.name': 'Shipper Name',
  'shipper.address': 'Shipper Address',
  'shipper.city': 'Shipper City',
  'shipper.state': 'Shipper State',
  'shipper.zipCode': 'Shipper Zip',
  'shipper.phone': 'Shipper Phone',
  'consignee.name': 'Consignee Name',
  'consignee.address': 'Consignee Address',
  'consignee.city': 'Consignee City',
  'consignee.state': 'Consignee State',
  'consignee.zipCode': 'Consignee Zip',
  'consignee.phone': 'Consignee Phone',
  weight: 'Weight',
  amount: 'Amount',
  truckNumber: 'Truck #',
};

// Utility to normalize line breaks in all string fields of an address
function normalizeAddressFields(addr: any) {
  const fields = ['name', 'address', 'city', 'state', 'zipCode', 'phone'];
  const out: any = { ...addr };
  fields.forEach(f => {
    if (typeof out[f] === 'string') {
      out[f] = out[f].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    }
  });
  return out;
}

export default function Home() {
  const [extractedData, setExtractedData] = useState<ExtractRateConDataOutput | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [fieldOrder, setFieldOrder] = useState<EditableField[]>(defaultFieldOrder);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [darkMode, setDarkMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [additionalAddresses, setAdditionalAddresses] = useState<{
    type: 'PU' | 'DP',
    name?: string,
    address?: string,
    city?: string,
    state?: string,
    zipCode?: string,
    phone?: string,
  }[]>([]);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [dataUris, setDataUris] = useState<string[]>([]);

  const handleEditChange = (field: EditableField, value: string) => {
    setExtractedData(prev => {
       if (!prev) return null;
       // Use the helper function to update the nested state immutably
       return setNestedValue(prev, field, value);
     });
   };

  const handleCopyToClipboard = () => {
    if (!extractedData) return;

    // Get the values from the extractedData based on the current fieldOrder
     // Use the helper to safely access nested values, defaulting to empty string
    const orderedData = fieldOrder.map(field => getNestedValue(extractedData, field));
     const tabSeparatedString = orderedData.join('\t');

    navigator.clipboard.writeText(tabSeparatedString)
      .then(() => {
        toast({
          title: "Copied to Clipboard",
          description: "Data ready for pasting (Tab-separated).",
        });
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        toast({
          title: "Copy Failed",
          description: "Could not copy data to clipboard.",
          variant: "destructive",
        });
      });
  };

   // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
       e.dataTransfer.effectAllowed = 'move';
       e.currentTarget.classList.add('dragging');
   };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
       e.preventDefault();
    
    if (draggedIndex === null || dragOverIndex === null) {
           return;
       }

       const newOrder = [...fieldOrder];
    const [draggedField] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dragOverIndex, 0, draggedField);

       setFieldOrder(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Clean up drag classes
    const container = e.currentTarget.closest('.space-y-4');
    if (container) {
      container.querySelectorAll('.draggable').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
      });
    }
  };

  // Modal zoom/pan handlers
  const handleModalOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setIsModalOpen(false);
  };

  // Arrow navigation handlers
  const handlePrevImage = () => setSelectedImageIdx(idx => Math.max(0, idx - 1));
  const handleNextImage = () => setSelectedImageIdx(idx => Math.min(dataUris.length - 1, idx + 1));

  // Enhanced zoom handler: zoom to cursor (accurate to image area)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    // Get the image's aspect ratio and size within the container
    const aspect = 16 / 9;
    let imgW = rect.width, imgH = rect.height;
    if (rect.width / rect.height > aspect) {
      imgH = rect.height;
      imgW = imgH * aspect;
    } else {
      imgW = rect.width;
      imgH = imgW / aspect;
    }
    // Image top-left in container
    const imgLeft = (rect.width - imgW) / 2;
    const imgTop = (rect.height - imgH) / 2;
    // Cursor position relative to image
    const cx = e.clientX - rect.left - imgLeft;
    const cy = e.clientY - rect.top - imgTop;
    // Only zoom if cursor is over the image
    if (cx < 0 || cy < 0 || cx > imgW || cy > imgH) return;
    const prevZoom = zoom;
    let newZoom = Math.max(1, Math.min(5, zoom - e.deltaY * 0.002));
    if (newZoom !== prevZoom) {
      // Calculate new pan so the zoom centers on the cursor (relative to image center)
      const imgCenterX = imgW / 2, imgCenterY = imgH / 2;
      const offsetX = cx - imgCenterX;
      const offsetY = cy - imgCenterY;
      const scale = newZoom / prevZoom;
      setPan(prev => ({
        x: (prev.x - offsetX) * scale + offsetX,
        y: (prev.y - offsetY) * scale + offsetY,
      }));
      setZoom(newZoom);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - (dragStart.current?.x ?? 0), y: e.clientY - (dragStart.current?.y ?? 0) });
  };
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  const handleDoubleClick = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setPan({ x: e.touches[0].clientX - (dragStart.current?.x ?? 0), y: e.touches[0].clientY - (dragStart.current?.y ?? 0) });
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Multi-file upload handler
  const handleFilesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    try {
      // Read all files as data URIs
      const dataUris = await Promise.all(selectedFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = event => resolve(event.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }));
      setImageDataUri(dataUris[0]);
      setSelectedImageIdx(0);
      setDataUris(dataUris);
      // Multi-page extraction
      const results = await extractRateConData({ photoDataUris: dataUris });
      // Build a single ordered list of all addresses as they appear
      const allAddresses: typeof additionalAddresses = [];
      results.forEach((r) => {
        if (r.shipper && Object.values(r.shipper).some(Boolean)) {
          allAddresses.push({ type: 'PU', ...normalizeAddressFields(r.shipper) });
        }
        if (r.consignee && Object.values(r.consignee).some(Boolean)) {
          allAddresses.push({ type: 'DP', ...normalizeAddressFields(r.consignee) });
        }
      });
      // Main shipper = first PU, main consignee = last DP
      const mainShipperIdx = allAddresses.findIndex(addr => addr.type === 'PU');
      const mainConsigneeIdx = (() => {
        let idx = -1;
        allAddresses.forEach((addr, i) => { if (addr.type === 'DP') idx = i; });
        return idx;
      })();
      const mainShipper = mainShipperIdx !== -1 ? normalizeAddressFields(allAddresses[mainShipperIdx]) : {};
      const mainConsignee = mainConsigneeIdx !== -1 ? normalizeAddressFields(allAddresses[mainConsigneeIdx]) : {};
      // Additional addresses: all others, in order, skipping main PU and main DP
      const additional: typeof additionalAddresses = allAddresses
        .map((addr, idx) => ({ ...normalizeAddressFields(addr), type: addr.type }))
        .filter((addr, idx) => idx !== mainShipperIdx && idx !== mainConsigneeIdx);
      setAdditionalAddresses(additional);
      // Set main extracted data for main shipper/consignee
      setExtractedData({ ...results[0], shipper: mainShipper, consignee: mainConsignee });
    } catch (error) {
      console.error('Error processing documents:', error);
      toast({
        title: "Error",
        description: "Failed to process the documents. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isModalOpen]);

  return (
    <main className={"min-h-screen bg-gradient-to-b from-background to-secondary/20 transition-colors duration-500 " + (darkMode ? 'dark' : '')}>
      {/* Dark mode toggle */}
      <button
        className="fixed top-4 right-4 z-50 p-2 rounded-full bg-white/80 dark:bg-black/60 shadow-lg border border-border hover:scale-110 transition-transform"
        onClick={() => setDarkMode(dm => !dm)}
        aria-label="Toggle dark mode"
      >
        {darkMode ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-8.66l-.71.71M4.05 19.07l-.71.71M21 12h-1M4 12H3m16.95-7.07l-.71.71M6.34 6.34l-.71-.71" /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-800 dark:text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" /></svg>
        )}
      </button>
      <div className="container mx-auto px-4 py-4">
        <div className="w-full flex flex-col items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-6 4h6a2 2 0 002-2V7a2 2 0 00-2-2h-1.5a1.5 1.5 0 01-3 0H9a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-br from-blue-500 via-blue-400 to-blue-700 bg-clip-text text-transparent animate-float">RateCon Scanner</h1>
          </div>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mt-2 text-center">Instantly extract and process data from your Rate Con documents using advanced AI technology</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* QR Code Display (left side) */}
          <QRDisplay className="animate-fadein" />

          {/* Upload Area (with image preview after upload) */}
          <Card className="glass hover-lift animate-fadein">
          <CardHeader>
              <CardTitle>Upload Document</CardTitle>
              <CardDescription>
                Upload your Rate Con document to extract the data automatically
              </CardDescription>
          </CardHeader>
            <CardContent>
              {/* Always use an aspect-[16/10] box for consistent sizing */}
              {!imageDataUri ? (
                <div className="relative aspect-[16/12.7] rounded-lg overflow-hidden border border-border flex items-center justify-center shadow-2xl" onContextMenu={e => e.preventDefault()}>
                  {/* Loading overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-black/50 rounded-lg">
                      <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-4 z-0 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-12 h-12 text-primary/60 animate-pulse-slow" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground">Supported formats: JPG, PNG, PDF</p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
              type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    multiple
                    onChange={handleFilesChange}
                  />
                </div>
              ) : (
                <div className="relative aspect-[16/12.7] rounded-lg overflow-hidden border border-border flex items-center justify-center shadow-2xl" onContextMenu={e => e.preventDefault()}>
                  {/* Reupload Button - top right */}
                  <button
                    className="btn-blue absolute top-3 right-3 px-4 py-2 text-sm font-semibold shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 z-20"
                    onClick={() => {
                      setImageDataUri(null);
                      setExtractedData(null);
                      setFiles([]);
                      setAdditionalAddresses([]);
                      fileInputRef.current?.click();
                    }}
                    type="button"
                  >
                    Reupload
                  </button>
                  {/* Thumbnails or filenames for all uploaded pages */}
                  {files.length > 1 && (
                    <div className="absolute left-3 bottom-3 flex gap-2 z-10">
                      {files.map((file, idx) => (
                        <button
                          key={idx}
                          className={`w-8 h-8 rounded shadow border-2 flex items-center justify-center text-xs font-bold transition-all ${selectedImageIdx === idx ? 'border-blue-500 ring-2 ring-blue-400' : 'border-blue-200'}`}
                          style={{ background: 'rgba(255,255,255,0.8)' }}
                          onClick={e => { e.stopPropagation(); setSelectedImageIdx(idx); }}
                          type="button"
                        >
                          {file.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(file)} alt={`Page ${idx+1}`} className="w-full h-full object-cover rounded" />
                          ) : (
                            <span>{idx+1}</span>
                          )}
                        </button>
                      ))}
              </div>
            )}
                  {/* Loading overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-black/50 rounded-lg">
                      <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    </div>
                  )}
                  <Image
                    src={dataUris[selectedImageIdx]}
                    alt="Uploaded Rate Con"
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    onClick={() => setIsModalOpen(true)}
                    style={{ cursor: 'zoom-in' }}
                  />
                </div>
              )}
              {/* Modal for zoomed image */}
              {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fadein" onClick={handleModalOverlayClick}>
                  <div
                    className="relative w-[90vw] max-w-3xl aspect-[16/9] bg-white dark:bg-black rounded-lg overflow-hidden flex items-center justify-center"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDoubleClick={handleDoubleClick}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{ cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'zoom-in' }}
                    onContextMenu={e => e.preventDefault()}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Left arrow */}
                    {selectedImageIdx > 0 && (
                      <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-black/60 rounded-full p-2 shadow z-20 hover:scale-110"
                        onClick={handlePrevImage}
                        aria-label="Previous page"
                        type="button"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                    )}
                    {/* Right arrow */}
                    {selectedImageIdx < dataUris.length - 1 && (
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-black/60 rounded-full p-2 shadow z-20 hover:scale-110"
                        onClick={handleNextImage}
                        aria-label="Next page"
                        type="button"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    )}
                    <Image
                      src={dataUris[selectedImageIdx]}
                      alt="Zoomed Rate Con"
                      fill
                      className="object-contain select-none"
                      sizes="100vw"
                      draggable={false}
                      style={{
                        transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                        transition: isDragging ? 'none' : 'transform 0.2s',
                        cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'zoom-in',
                      }}
                    />
                    <button className="absolute top-2 right-2 bg-white/80 dark:bg-black/60 rounded-full p-1 shadow" onClick={e => { e.stopPropagation(); setIsModalOpen(false); }} aria-label="Close zoomed image">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

          {/* Extracted Data (right side) */}
          <div className="relative animate-fadein">
            {(isProcessing || (extractedData && !isProcessing)) && (
              <Card className="glass hover-lift">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Extracted Data</CardTitle>
                    <CardDescription>Review and edit the extracted information</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyToClipboard}
                    className="ml-2 btn-blue hover:bg-blue-600/90 focus:ring-2 focus:ring-blue-400"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
          </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Row 1: Load # and Weight */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="loadNumber" className="text-sm font-medium">
                          Load #
                        </Label>
                        <Input
                          id="loadNumber"
                          value={getNestedValue(extractedData, 'loadNumber')}
                          onChange={(e) => handleEditChange('loadNumber', e.target.value)}
                          className="transition-custom focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight" className="text-sm font-medium">
                          Weight
                        </Label>
                        <Input
                          id="weight"
                          value={getNestedValue(extractedData, 'weight')}
                          onChange={(e) => handleEditChange('weight', e.target.value)}
                          className="transition-custom focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                    </div>

                    {/* Row 2: Shipper Name and Consignee Name */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shipper.name" className="text-sm font-medium">
                          Shipper Name
                        </Label>
                        <Input
                          id="shipper.name"
                          value={getNestedValue(extractedData, 'shipper.name')}
                          onChange={(e) => handleEditChange('shipper.name', e.target.value)}
                          className="transition-custom focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="consignee.name" className="text-sm font-medium">
                          Consignee Name
                        </Label>
                        <Input
                          id="consignee.name"
                          value={getNestedValue(extractedData, 'consignee.name')}
                          onChange={(e) => handleEditChange('consignee.name', e.target.value)}
                          className="transition-custom focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                    </div>

                    {/* Row 3: Addresses */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shipper.address" className="text-sm font-medium">
                          Shipper Address
                        </Label>
                        <Input
                          id="shipper.address"
                          value={getNestedValue(extractedData, 'shipper.address')}
                          onChange={(e) => handleEditChange('shipper.address', e.target.value)}
                          className="transition-custom focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="consignee.address" className="text-sm font-medium">
                          Consignee Address
                        </Label>
                        <Input
                          id="consignee.address"
                          value={getNestedValue(extractedData, 'consignee.address')}
                          onChange={(e) => handleEditChange('consignee.address', e.target.value)}
                          className="transition-custom focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                    </div>

                    {/* Row 4: City, State, Zip */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-2">
                          <Label htmlFor="shipper.city" className="text-sm font-medium">
                            City
                          </Label>
                          <Input
                            id="shipper.city"
                            value={getNestedValue(extractedData, 'shipper.city')}
                            onChange={(e) => handleEditChange('shipper.city', e.target.value)}
                            className="transition-custom focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="shipper.state" className="text-sm font-medium">
                            State
                          </Label>
                          <Input
                            id="shipper.state"
                            value={getNestedValue(extractedData, 'shipper.state')}
                            onChange={(e) => handleEditChange('shipper.state', e.target.value)}
                            className="transition-custom focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="shipper.zipCode" className="text-sm font-medium">
                            ZIP
                          </Label>
                          <Input
                            id="shipper.zipCode"
                            value={getNestedValue(extractedData, 'shipper.zipCode')}
                            onChange={(e) => handleEditChange('shipper.zipCode', e.target.value)}
                            className="transition-custom focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-2">
                          <Label htmlFor="consignee.city" className="text-sm font-medium">
                            City
                          </Label>
                          <Input
                            id="consignee.city"
                            value={getNestedValue(extractedData, 'consignee.city')}
                            onChange={(e) => handleEditChange('consignee.city', e.target.value)}
                            className="transition-custom focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="consignee.state" className="text-sm font-medium">
                            State
                          </Label>
                          <Input
                            id="consignee.state"
                            value={getNestedValue(extractedData, 'consignee.state')}
                            onChange={(e) => handleEditChange('consignee.state', e.target.value)}
                            className="transition-custom focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="consignee.zipCode" className="text-sm font-medium">
                            ZIP
                          </Label>
                          <Input
                            id="consignee.zipCode"
                            value={getNestedValue(extractedData, 'consignee.zipCode')}
                            onChange={(e) => handleEditChange('consignee.zipCode', e.target.value)}
                            className="transition-custom focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 5: Phone Numbers */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shipper.phone" className="text-sm font-medium">
                          Shipper Phone
                        </Label>
                        <Input
                          id="shipper.phone"
                          value={getNestedValue(extractedData, 'shipper.phone')}
                          onChange={(e) => handleEditChange('shipper.phone', e.target.value)}
                          className="transition-custom focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="consignee.phone" className="text-sm font-medium">
                          Consignee Phone
                        </Label>
                        <Input
                          id="consignee.phone"
                          value={getNestedValue(extractedData, 'consignee.phone')}
                          onChange={(e) => handleEditChange('consignee.phone', e.target.value)}
                          className="transition-custom focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                    </div>

                    {/* Row 6: Amount and Truck # */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount" className="text-sm font-medium">
                          Amount
                        </Label>
                        <Input
                          id="amount"
                          value={getNestedValue(extractedData, 'amount')}
                          onChange={(e) => handleEditChange('amount', e.target.value)}
                          className="transition-custom focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="truckNumber" className="text-sm font-medium">
                          Truck #
                        </Label>
                             <Input
                          id="truckNumber"
                          value={getNestedValue(extractedData, 'truckNumber')}
                          onChange={(e) => handleEditChange('truckNumber', e.target.value)}
                          className="transition-custom focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                    </div>
                 </div>
                </CardContent>
              </Card>
            )}
            {isProcessing && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 dark:bg-black/50 rounded-lg">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
        {additionalAddresses.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Additional Extracted Data</h2>
            <div className="space-y-4">
              {additionalAddresses.map((addr, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap gap-2 items-center glass dark:bg-[rgba(20,25,40,0.92)] bg-white/80 rounded-xl p-4 shadow border border-border"
                >
                  <span className="font-semibold px-3 py-1 rounded-lg bg-blue-600/90 dark:bg-blue-800/80 text-white dark:text-blue-200 w-12 text-center shadow-sm">
                    {addr.type}
                  </span>
                  <Input
                    className="w-40 dark:bg-[#151c2c] dark:text-blue-100 dark:border-[#233056]"
                    value={addr.name || ''}
                    onChange={e => {
                      const updated = [...additionalAddresses];
                      updated[idx].name = e.target.value;
                      setAdditionalAddresses(updated);
                    }}
                    placeholder="Name/Location"
                  />
                  <Input
                    className="w-56 dark:bg-[#151c2c] dark:text-blue-100 dark:border-[#233056]"
                    value={addr.address || ''}
                    onChange={e => {
                      const updated = [...additionalAddresses];
                      updated[idx].address = e.target.value;
                      setAdditionalAddresses(updated);
                    }}
                    placeholder="Address"
                  />
                  <Input
                    className="w-32 dark:bg-[#151c2c] dark:text-blue-100 dark:border-[#233056]"
                    value={addr.city || ''}
                    onChange={e => {
                      const updated = [...additionalAddresses];
                      updated[idx].city = e.target.value;
                      setAdditionalAddresses(updated);
                    }}
                    placeholder="City"
                  />
                  <Input
                    className="w-16 dark:bg-[#151c2c] dark:text-blue-100 dark:border-[#233056]"
                    value={addr.state || ''}
                    onChange={e => {
                      const updated = [...additionalAddresses];
                      updated[idx].state = e.target.value;
                      setAdditionalAddresses(updated);
                    }}
                    placeholder="State"
                  />
                  <Input
                    className="w-32 dark:bg-[#151c2c] dark:text-blue-100 dark:border-[#233056]"
                    value={addr.phone || ''}
                    onChange={e => {
                      const updated = [...additionalAddresses];
                      updated[idx].phone = e.target.value;
                      setAdditionalAddresses(updated);
                    }}
                    placeholder="Phone"
                  />
                  <Input
                    className="w-20 dark:bg-[#151c2c] dark:text-blue-100 dark:border-[#233056]"
                    value={addr.zipCode || ''}
                    onChange={e => {
                      const updated = [...additionalAddresses];
                      updated[idx].zipCode = e.target.value;
                      setAdditionalAddresses(updated);
                    }}
                    placeholder="Zip"
                  />
                  <button
                    className="btn-blue ml-2 px-3 py-2 text-xs font-semibold shadow hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-lg"
                    onClick={() => {
                      const toCopy = [addr.name, addr.address, addr.city, addr.state, addr.phone, addr.zipCode].map(f => f || '').join('\t');
                      navigator.clipboard.writeText(toCopy).then(() => {
                        toast({ title: 'Copied!', description: 'Additional address copied to clipboard.' });
                      });
                    }}
                    type="button"
                    aria-label="Copy this address"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
       <style jsx global>{`
        html, body {
          font-family: 'Inter', 'Poppins', 'Segoe UI', Arial, sans-serif;
        }
        body {
          background: linear-gradient(135deg,rgb(169, 192, 221) 0%, #e3f0ff 100%);
          position: relative;
        }
        body::after {
          content: '';
          position: fixed;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background: url('https://www.transparenttextures.com/patterns/cubes.png'); /* subtle noise pattern */
          opacity: 0.08;
        }
        .glass {
          background: rgba(255,255,255,0.85);
          border: 1.5px solid rgba(30, 64, 175, 0.08);
          box-shadow: 0 8px 32px 0 rgba(30, 64, 175, 0.10), 0 0 0 1.5px rgba(96, 165, 250, 0.10) inset;
          backdrop-filter: blur(18px);
          transition: box-shadow 0.2s, border-color 0.2s, transform 0.2s;
        }
        .hover-lift:hover {
          box-shadow: 0 16px 40px 0 rgba(30, 64, 175, 0.22), 0 0 0 2px #6366f1;
          transform: translateY(-2px) scale(1.015);
          border-color: #6366f1;
        }
        .btn-blue {
          background: linear-gradient(90deg, #2563eb 0%, #6366f1 100%);
          color: #fff;
          font-weight: 600;
          border-radius: 0.5rem;
          box-shadow: 0 2px 8px 0 rgba(30, 64, 175, 0.10);
          border: 2px solid transparent;
          background-clip: padding-box, border-box;
          transition: background 0.2s, box-shadow 0.2s, transform 0.2s, border-color 0.2s;
        }
        .btn-blue:hover, .btn-blue:focus {
          background: linear-gradient(90deg, #1d4ed8 0%, #a78bfa 100%);
          box-shadow: 0 4px 16px 0 #6366f1cc;
          transform: translateY(-1px) scale(1.04);
          border-color: #a78bfa;
        }
        input, textarea {
          background: #fff;
          color: #222;
          border-radius: 0.375rem;
          border: 1.5px solid #e5e7eb;
          transition: box-shadow 0.2s, border-color 0.2s, transform 0.2s;
          font-family: inherit;
        }
        input:focus, textarea:focus {
          outline: none;
          box-shadow: 0 0 0 2px #6366f1;
          border-color: #6366f1;
          transform: scale(1.025);
        }
        label {
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #60a5fa88 50%, transparent);
          margin: 1.5rem 0;
          border: none;
        }
        /* DARK MODE */
        body.dark, main.dark, .dark .min-h-screen, .dark .bg-gradient-to-b {
          background: #0a0f1a !important;
        }
        body.dark::before {
          content: '';
          position: fixed;
          inset: 0;
          z-index: -1;
          background: none;
          pointer-events: none;
        }
        body.dark::after {
          opacity: 0.10;
        }
        .dark .glass {
          background: rgba(30, 41, 59, 0.72);
          border: 1.5px solid #2563eb55;
          box-shadow: 0 8px 32px 0 #2563eb33, 0 0 0 1.5px #6366f144 inset;
          backdrop-filter: blur(22px);
        }
        .dark .hover-lift:hover {
          box-shadow: 0 20px 48px 0 #2563ebcc, 0 0 0 2px #60a5fa;
          border-color: #60a5fa;
        }
        .dark .btn-blue {
          background: linear-gradient(90deg, #2563eb 0%, #6366f1 100%);
          color: #fff;
          border: 2px solid #233056;
          box-shadow: 0 2px 8px 0 #2563eb44;
        }
        .dark .btn-blue:hover, .dark .btn-blue:focus {
          background: linear-gradient(90deg, #6366f1 0%, #a78bfa 100%);
          box-shadow: 0 4px 16px 0 #60a5fa99;
          border-color: #60a5fa;
        }
        .dark input, .dark textarea {
          background: #1e293b;
          color: #e0e7ef;
          border: 1.5px solid #334155;
        }
        .dark input:focus, .dark textarea:focus {
          box-shadow: 0 0 0 2px #60a5fa;
          border-color: #60a5fa;
          transform: scale(1.025);
        }
        .dark label {
          color: #c7d2fe;
        }
        .dark .text-muted-foreground {
          color: #7ea2ce !important;
        }
        .divider {
          background: linear-gradient(90deg, transparent, #2563ebcc 50%, transparent);
        }
       `}</style>
    </main>
  );
}
