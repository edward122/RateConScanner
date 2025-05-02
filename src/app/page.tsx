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
import { Upload, Copy, Loader2, GripVertical } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define type for individual address components
type Address = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
};

// Flattened type for editing and ordering
type EditableField =
  | 'loadNumber'
  | 'shipper.name'
  | 'shipper.address'
  | 'shipper.city'
  | 'shipper.state'
  | 'shipper.zipCode'
  | 'consignee.name'
  | 'consignee.address'
  | 'consignee.city'
  | 'consignee.state'
  | 'consignee.zipCode'
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
      return ''; // Return empty string if path doesn't exist
    }
  }
  // Ensure return value is a string, handling null/undefined
  return String(value ?? '');
};


// Helper function to set nested value
const setNestedValue = (obj: any, path: string, value: string): any => {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {}; // Create nested object if it doesn't exist
    }
    current = current[key];
  }
  // Handle potential empty string or null/undefined from input
  current[keys[keys.length - 1]] = value === '' ? undefined : value;
  return { ...obj }; // Return a new object copy
};


const defaultFieldOrder: EditableField[] = [
  'loadNumber',
  'shipper.name',
  'shipper.address',
  'shipper.city',
  'shipper.state',
  'shipper.zipCode',
  'consignee.name',
  'consignee.address',
  'consignee.city',
  'consignee.state',
  'consignee.zipCode',
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
  'consignee.name': 'Consignee Name',
  'consignee.address': 'Consignee Address',
  'consignee.city': 'Consignee City',
  'consignee.state': 'Consignee State',
  'consignee.zipCode': 'Consignee Zip',
  weight: 'Weight',
  amount: 'Amount',
  truckNumber: 'Truck #',
};

export default function Home() {
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  // Store the raw, nested data structure from AI
  const [extractedData, setExtractedData] = useState<ExtractRateConDataOutput | null>(null);
  // Store the potentially edited, nested data structure
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
      setImageDataUri(null); // Reset image preview

      // Basic file type validation
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
       if (!allowedTypes.includes(file.type)) {
         setError('Invalid file type. Please upload PNG, JPG, JPEG, or PDF.');
         setIsLoading(false);
         return;
       }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setImageDataUri(dataUri);
        try {
          const result = await extractRateConData({ photoDataUri: dataUri });
           // Ensure shipper/consignee exist as objects before setting state
           // Also initialize potentially missing fields within address objects to empty strings for consistent display
           const initializeAddress = (addr?: Address): Address => ({
              name: addr?.name ?? '',
              address: addr?.address ?? '',
              city: addr?.city ?? '',
              state: addr?.state ?? '',
              zipCode: addr?.zipCode ?? '',
            });

            const initializedResult = {
              loadNumber: result.loadNumber ?? '',
              shipper: initializeAddress(result.shipper),
              consignee: initializeAddress(result.consignee),
              weight: result.weight ?? '',
              amount: result.amount ?? '',
              truckNumber: result.truckNumber ?? '',
            };
          setExtractedData(initializedResult);
          setEditedData(initializedResult); // Initialize edited data
        } catch (err) {
          console.error("Error extracting data:", err);
          setError("Failed to extract data from the image. Please try again or check the image quality.");
          setImageDataUri(null); // Clear preview on error
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
     setEditedData(prev => {
       if (!prev) return null;
       // Use the helper function to update the nested state immutably
       return setNestedValue(prev, field, value);
     });
   };

  const handleCopyToClipboard = () => {
    if (!editedData) return;

     // Get the values from the editedData based on the current fieldOrder
     // Use the helper to safely access nested values, defaulting to empty string
     const orderedData = fieldOrder.map(field => getNestedValue(editedData, field));
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

    if (currentIndex === -1 || targetIndex === -1) {
      console.error("Drag/Drop error: Field not found in order.");
      setDraggedField(null);
      return;
    }


    const newOrder = [...fieldOrder];
    newOrder.splice(currentIndex, 1); // Remove dragged item
    newOrder.splice(targetIndex, 0, draggedField); // Insert at target position

    setFieldOrder(newOrder);
    setDraggedField(null);
  };

   const orderedEditableData = useMemo(() => {
     if (!editedData) return [];
     // Map the ordered fields to their values from the nested editedData
     // Use the helper to safely access nested values, defaulting to empty string
     return fieldOrder.map(field => ({
       field,
       value: getNestedValue(editedData, field)
     }));
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
                 {/* Using AlertCircle for destructive alerts */}
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                 <AlertTitle>Error</AlertTitle>
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
              {/* Using a generic Edit icon as FileEdit is not in lucide */}
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
               Extracted Data & Field Order
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
                           <TableCell className="cursor-grab active:cursor-grabbing p-2 w-10">
                             <GripVertical className="w-4 h-4 text-muted-foreground" />
                           </TableCell>
                           <TableCell className="font-medium w-1/3 p-2">
                             {/* Use the flat field name for the label ID */}
                             <Label htmlFor={field.replace('.', '-')}>{fieldLabels[field]}</Label>
                           </TableCell>
                           <TableCell className="w-2/3 p-2">
                             <Input
                               id={field.replace('.', '-')} // Ensure ID is valid HTML
                               value={value}
                               onChange={(e) => handleEditChange(field, e.target.value)}
                               className="text-sm h-8" // Adjusted height
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

    