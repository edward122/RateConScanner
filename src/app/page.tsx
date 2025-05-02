'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { extractRateConData, type ExtractRateConDataOutput } from '@/ai/flows/extract-rate-con-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from "@/hooks/use-toast";
import { Upload, Copy, Edit, Loader2, GripVertical } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type EditableField = keyof ExtractRateConDataOutput;
const defaultFieldOrder: EditableField[] = [
  'loadNumber',
  'shipper',
  'consignee',
  'weight',
  'amount',
  'truckNumber',
];
const fieldLabels: Record<EditableField, string> = {
  loadNumber: 'Load #',
  shipper: 'Shipper',
  consignee: 'Consignee',
  weight: 'Weight',
  amount: 'Amount',
  truckNumber: 'Truck #',
};

export default function Home() {
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractRateConDataOutput | null>(null);
  const [editedData, setEditedData] = useState<ExtractRateConDataOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldOrder, setFieldOrder] = useState<EditableField[]>(defaultFieldOrder);
  const [draggedField, setDraggedField] = useState<EditableField | null>(null);
  const { toast } = useToast();

  const handleImageUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsLoading(true);
      setError(null);
      setExtractedData(null);
      setEditedData(null);

      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setImageDataUri(dataUri);
        try {
          const result = await extractRateConData({ photoDataUri: dataUri });
          setExtractedData(result);
          setEditedData(result); // Initialize edited data with extracted data
        } catch (err) {
          console.error("Error extracting data:", err);
          setError("Failed to extract data from the image. Please try again or check the image quality.");
          setImageDataUri(null);
        } finally {
          setIsLoading(false);
        }
      };
      reader.onerror = () => {
        setError("Failed to read the image file.");
        setIsLoading(false);
        setImageDataUri(null);
      }
      reader.readAsDataURL(file);
    }
  }, []);

  const handleEditChange = (field: EditableField, value: string) => {
    setEditedData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleCopyToClipboard = () => {
    if (!editedData) return;

    const orderedData = fieldOrder.map(field => editedData[field] ?? '');
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

  const handleDragStart = (field: EditableField) => {
    setDraggedField(field);
  };

  const handleDragOver = (event: React.DragEvent<HTMLTableRowElement>) => {
    event.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (targetField: EditableField) => {
    if (!draggedField || draggedField === targetField) {
        setDraggedField(null);
        return;
    }

    const currentIndex = fieldOrder.indexOf(draggedField);
    const targetIndex = fieldOrder.indexOf(targetField);

    const newOrder = [...fieldOrder];
    newOrder.splice(currentIndex, 1); // Remove dragged item
    newOrder.splice(targetIndex, 0, draggedField); // Insert at target position

    setFieldOrder(newOrder);
    setDraggedField(null);
  };

  const orderedEditableData = useMemo(() => {
    if (!editedData) return [];
    return fieldOrder.map(field => ({ field, value: editedData[field] ?? '' }));
  }, [editedData, fieldOrder]);

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background text-foreground">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary">RateCon TurboScan</h1>
        <p className="text-muted-foreground">Upload Rate Con documents, extract data, and prepare for macro input.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Upload & Image Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> Upload Rate Con
            </CardTitle>
             <CardDescription>Select an image file (JPG, PNG, PDF) of the Rate Confirmation document.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              id="rate-con-upload"
              type="file"
              accept="image/png, image/jpeg, image/jpg, application/pdf"
              onChange={handleImageUpload}
              disabled={isLoading}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="ml-2">Processing image...</p>
              </div>
            )}
            {error && (
               <Alert variant="destructive">
                 <Upload className="h-4 w-4" />
                 <AlertTitle>Extraction Error</AlertTitle>
                 <AlertDescription>{error}</AlertDescription>
               </Alert>
             )}
            {imageDataUri && !isLoading && !error && (
              <div className="mt-4 border rounded-md p-2 bg-secondary/30">
                <p className="text-sm font-medium mb-2 text-center">Image Preview:</p>
                <div className="relative aspect-video">
                  <Image
                    src={imageDataUri}
                    alt="Uploaded Rate Con"
                    layout="fill"
                    objectFit="contain"
                    data-ai-hint="document scan rate confirmation"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Extracted Data & Field Ordering */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" /> Extracted Data & Field Order
            </CardTitle>
            <CardDescription>Review, edit, and reorder the extracted fields for macro pasting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {editedData ? (
              <>
                <div className="overflow-x-auto">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead className="w-10"></TableHead> {/* Drag Handle */}
                         <TableHead>Field</TableHead>
                         <TableHead>Extracted Value</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {orderedEditableData.map(({ field, value }) => (
                         <TableRow
                           key={field}
                           draggable
                           onDragStart={() => handleDragStart(field)}
                           onDragOver={handleDragOver}
                           onDrop={() => handleDrop(field)}
                           className={`cursor-move ${draggedField === field ? 'opacity-50 bg-accent/20' : ''}`}
                         >
                           <TableCell className="cursor-grab active:cursor-grabbing">
                             <GripVertical className="w-4 h-4 text-muted-foreground" />
                           </TableCell>
                           <TableCell className="font-medium w-1/3">
                             <Label htmlFor={field}>{fieldLabels[field]}</Label>
                           </TableCell>
                           <TableCell className="w-2/3">
                             <Input
                               id={field}
                               value={value}
                               onChange={(e) => handleEditChange(field, e.target.value)}
                               className="text-sm"
                               aria-label={`Edit ${fieldLabels[field]}`}
                             />
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </div>
                 <Button onClick={handleCopyToClipboard} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                   <Copy className="mr-2 h-4 w-4" /> Copy Data for Macro (Tab-separated)
                 </Button>
               </>
            ) : (
              <div className="text-center text-muted-foreground p-8 border border-dashed rounded-md">
                {isLoading ? 'Processing...' : 'Upload an image to see extracted data.'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
