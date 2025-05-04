'use server';
/**
 * @fileOverview This file defines a Genkit flow for extracting data from Rate Con documents using image analysis.
 *
 * - extractRateConData - A function that takes an image of a Rate Con document and returns the extracted data.
 * - ExtractRateConDataInput - The input type for the extractRateConData function, which is an image data URI.
 * - ExtractRateConDataOutput - The output type for the extractRateConData function, which contains the extracted fields including structured addresses.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ExtractRateConDataInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a Rate Con document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractRateConDataInput = z.infer<typeof ExtractRateConDataInputSchema>;

// Define a reusable schema for address components
const AddressSchema = z.object({
  name: z.string().optional().describe('The name of the company or location (e.g., "ACME Corp", "Warehouse B").'),
  address: z.string().optional().describe('The street address line (e.g., "123 Main St", "456 Industrial Ave Suite 100").'),
  city: z.string().optional().describe('The city name (e.g., "Anytown").'),
  state: z.string().optional().describe('The 2-letter state or province abbreviation (e.g., "CA", "TX", "ON").'),
  zipCode: z.string().optional().describe('The postal or ZIP code (e.g., "90210", "10001-1234"). must only be 5 numbers'),
}).describe('Structured address information. Each field must contain ONLY the corresponding part of the address. Leave fields blank if not found.');


const ExtractRateConDataOutputSchema = z.object({
  loadNumber: z.string().optional().describe('The load number or PRO number from the Rate Con document.'),
  shipper: AddressSchema.optional().describe('The structured address information for the shipper. Leave fields blank if not found.'),
  consignee: AddressSchema.optional().describe('The structured address information for the consignee. Leave fields blank if not found.'),
  weight: z.string().optional().describe('The weight from the Rate Con document. (only include numbers)'),
  amount: z.string().optional().describe('The total linehaul amount/rate from the Rate Con document.'),
  truckNumber: z.string().optional().describe('is handwritten near the top or header (Leave fields blank if not readibly)'),
});
export type ExtractRateConDataOutput = z.infer<typeof ExtractRateConDataOutputSchema>;

export type ExtractRateConDataMultiInput = { photoDataUris: string[] };
export type ExtractRateConDataMultiOutput = ExtractRateConDataOutput[];

export async function extractRateConData({ photoDataUris }: ExtractRateConDataMultiInput): Promise<ExtractRateConDataMultiOutput> {
  // Process each page with the existing extraction logic
  const results: ExtractRateConDataOutput[] = [];
  for (const uri of photoDataUris) {
    const singleResult = await extractRateConDataFlow({ photoDataUri: uri });
    results.push(singleResult);
  }
  return results;
}

const extractRateConDataPrompt = ai.definePrompt({
  name: 'extractRateConDataPrompt',
  input: {
    schema: ExtractRateConDataInputSchema, // Input is the image data URI
  },
  output: {
    schema: ExtractRateConDataOutputSchema,
  },
  prompt: `You are an expert data extraction specialist, skilled at extracting information from images of Rate Confirmation documents (Rate Cons).

  Analyze the provided image of a Rate Con document and extract the following fields:

  - Load Number: Find the load number (sometimes called PRO number).
  - Shipper: Locate the shipper's information. Extract the Name, Street Address, City, State (2-letter code), and Zip Code separately. Return this as a structured JSON object within the 'shipper' field. Leave individual fields blank if not found.
  - Consignee: Locate the consignee's (receiver's) information. Extract the Name, Street Address, City, State (2-letter code), and Zip Code separately. Return this as a structured JSON object within the 'consignee' field. Leave individual fields blank if not found.
  - Weight: Find the weight value.
  - Amount: Find the total linehaul amount or rate.
  - Truck Number: Locate the truck number if it's present, often near the top middle.

  Image: {{media url=photoDataUri}}

  Return the extracted data as a single, valid, parseable JSON object conforming to the output schema.
  - For Shipper and Consignee, provide the information as nested JSON objects.
  - If any specific field (like load number, weight, amount, truck number, or an individual address component like city or zipCode) is not clearly visible or identifiable, return an empty string "" or null for that specific field within the JSON structure. Do not invent or guess information.
  - Ensure the final output is ONLY the JSON object, with no extra text, explanations, or formatting before or after it.
  `,
});

const extractRateConDataFlow = ai.defineFlow<
  typeof ExtractRateConDataInputSchema,
  typeof ExtractRateConDataOutputSchema
>(
  {
    name: 'extractRateConDataFlow',
    inputSchema: ExtractRateConDataInputSchema,
    outputSchema: ExtractRateConDataOutputSchema,
  },
  async (input): Promise<ExtractRateConDataOutput> => {
    console.log("Sending input to AI:", input);
    // Directly call the prompt with the image data URI
    const {output} = await extractRateConDataPrompt(input);
     console.log("Raw AI Output Received:", output); // Log raw output

    // Ensure output is not null or undefined before returning
    if (!output) {
      throw new Error("Failed to generate output from the prompt.");
    }

     // Basic validation/initialization - ensure shipper/consignee are objects if they exist
     const result: ExtractRateConDataOutput = {
       loadNumber: output.loadNumber ?? '',
       shipper: typeof output.shipper === 'object' ? output.shipper : { name: '', address: '', city: '', state: '', zipCode: '' },
       consignee: typeof output.consignee === 'object' ? output.consignee : { name: '', address: '', city: '', state: '', zipCode: '' },
       weight: output.weight ?? '',
       amount: output.amount ?? '',
       truckNumber: output.truckNumber ?? '',
     };

     console.log("Processed Output:", result);
     return result;
  }
);
