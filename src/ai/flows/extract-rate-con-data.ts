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
  zipCode: z.string().optional().describe('The postal or ZIP code (e.g., "90210", "10001-1234").'),
}).describe('Structured address information. Each field must contain ONLY the corresponding part of the address. CRITICAL: Return a valid JSON object for the address, NOT the string "[object Object]". Example: {"name": "Shipper Inc", "address": "100 Market St", "city": "Metropolis", "state": "NY", "zipCode": "10001"}');


const ExtractRateConDataOutputSchema = z.object({
  loadNumber: z.string().optional().describe('The load number or PRO number from the Rate Con document.'),
  shipper: AddressSchema.optional().describe('The structured address information for the shipper. CRITICAL: Return a valid JSON object, NOT the string "[object Object]". Example: {"name": "Shipper Inc", ...}'),
  consignee: AddressSchema.optional().describe('The structured address information for the consignee. CRITICAL: Return a valid JSON object, NOT the string "[object Object]". Example: {"name": "Receiver Co", ...}'),
  weight: z.string().optional().describe('The weight from the Rate Con document. CRITICAL: Extract ONLY the numeric value (digits and optionally a decimal point). Remove ALL surrounding text, labels, units (like "lbs", "kg"), commas, and other non-numeric characters. Example: if document shows "Weight: 48,000 lbs", extract "48000". If "Net Wt.: 45.5KG", extract "45.5". If "Wt: 42, 500 LB", extract "42500".'),
  amount: z.string().optional().describe('The total linehaul amount/rate from the Rate Con document. CRITICAL: Extract ONLY the numeric value (digits and optionally a decimal point). Remove ALL surrounding text, labels, currency symbols (like "$", "USD"), commas, and other non-numeric characters. Example: if document shows "USD 1,500.00", extract "1500.00" or "1500". If "Rate: $1,200", extract "1200". If "Freight Cost: 2,150.50", extract "2150.50".'),
  truckNumber: z.string().optional().describe('The truck number from the Rate Con document, if available. Often found near the top middle of the document.'),
});
export type ExtractRateConDataOutput = z.infer<typeof ExtractRateConDataOutputSchema>;

// Helper type for address, ensuring all keys are optional strings
type Address = z.infer<typeof AddressSchema>;


export async function extractRateConData(input: ExtractRateConDataInput): Promise<ExtractRateConDataOutput> {
  return extractRateConDataFlow(input);
}

const extractRateConDataPrompt = ai.definePrompt({
  name: 'extractRateConDataPrompt',
  input: {
    schema: ExtractRateConDataInputSchema, // Input is the image data URI
  },
  output: {
    schema: ExtractRateConDataOutputSchema,
  },
  prompt: `You are an expert data extraction specialist, highly skilled at accurately extracting specific information from images of Rate Confirmation documents (Rate Cons).

  Analyze the provided image of a Rate Con document and extract the following fields precisely according to the requirements:

  - Load Number: Find the load number (sometimes called PRO number). Extract it exactly as it appears.
  - Shipper: Locate the shipper's information. Extract the Name, Street Address, City, State (2-letter code), and Zip Code separately. Return this as a structured JSON object within the 'shipper' field. **CRITICAL: The value for 'shipper' MUST be a JSON object like \`{"name": "Shipper Inc", "address": "123 Load St", "city": "Origin", "state": "CA", "zipCode": "90001"}\`. DO NOT return the literal string "[object Object]".**
  - Consignee: Locate the consignee's (receiver's) information. Extract the Name, Street Address, City, State (2-letter code), and Zip Code separately. Return this as a structured JSON object within the 'consignee' field. **CRITICAL: The value for 'consignee' MUST be a JSON object like \`{"name": "Receiver Co", "address": "456 Delivery Ave", "city": "Destination", "state": "TX", "zipCode": "75001"}\`. DO NOT return the literal string "[object Object]".**
  - Weight: Find the weight value, often labeled 'Weight', 'Total Weight', or similar. **CRITICAL: Extract ONLY the numeric digits and at most one decimal point.** Remove ALL other characters, including labels, units (like "lbs", "kg"), commas, and surrounding text.
      - Example 1: If the document says "Weight: 48,000 lbs", extract exactly "48000".
      - Example 2: If the document says "45.5 KG Net", extract exactly "45.5".
      - Example 3: If the document shows "Weight: 42,500", extract "42500".
      - Example 4: If "Wt: 3, 500.75 lb", extract "3500.75".
  - Amount: Find the total linehaul amount or rate, often labeled 'Rate', 'Amount', 'Total Cost', 'Freight Charges', or similar. **CRITICAL: Extract ONLY the numeric digits and at most one decimal point.** Remove ALL other characters, including labels, currency symbols ('$', 'USD', etc.), commas, and surrounding text.
      - Example 1: If the document says "Total Cost USD 1,500.00", extract exactly "1500.00" or "1500".
      - Example 2: If the document says "Rate: $1,200", extract exactly "1200".
      - Example 3: If it shows "Freight: 2,150.50 USD", extract "2150.50".
  - Truck Number: Locate the truck number if it's present. This is often found near the top middle section of the document. Extract it exactly as it appears.

  Image: {{media url=photoDataUri}}

  **Output Format:**
  Return the extracted data as a single, valid, parseable JSON object conforming EXACTLY to the output schema.
  - For Shipper and Consignee, provide the information as nested JSON objects as specified.
  - If any specific field (like load number, weight, amount, truck number, or any individual address component like city or zipCode) is not clearly visible or identifiable in the image, return 'null' or an empty string "" for that specific field within the JSON structure. Do not invent or guess information.
  - Ensure the final output is ONLY the JSON object, with no extra text, explanations, or formatting before or after it.
  `,
});

// Helper to initialize address object, ensuring all keys exist and are strings
const initializeAddress = (addr?: Partial<Address> | string | any): Address => {
    // Handle cases where the AI might return a string or something unexpected instead of an object
    if (typeof addr !== 'object' || addr === null || Array.isArray(addr)) {
      console.warn("Received non-object for address, initializing empty:", addr);
      return { name: '', address: '', city: '', state: '', zipCode: '' };
    }
    return {
        name: addr?.name ?? '',
        address: addr?.address ?? '',
        city: addr?.city ?? '',
        state: addr?.state ?? '',
        zipCode: addr?.zipCode ?? '',
    };
};


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

    // --- Post-processing and Cleaning ---

    // 1. Clean Weight: Remove non-numeric characters (except decimal point)
    let cleanedWeight = output.weight ? String(output.weight).replace(/[^0-9.]/g, '') : '';
    // Ensure only one decimal point exists, keep the first part
    const weightParts = cleanedWeight.split('.');
    if (weightParts.length > 2) {
        cleanedWeight = `${weightParts[0]}.${weightParts.slice(1).join('')}`; // Join decimals back if multiple dots appear
    } else if (weightParts.length === 2 && weightParts[1] === '') {
         cleanedWeight = weightParts[0]; // Handle trailing dot like "1500." -> "1500"
    } else if (weightParts.length === 1 && cleanedWeight.endsWith('.')){
        cleanedWeight = cleanedWeight.slice(0,-1); // Remove trailing dot if no decimals
    }


    // 2. Clean Amount: Remove non-numeric characters (except decimal point)
    let cleanedAmount = output.amount ? String(output.amount).replace(/[^0-9.]/g, '') : '';
    // Ensure only one decimal point exists
    const amountParts = cleanedAmount.split('.');
     if (amountParts.length > 2) {
         cleanedAmount = `${amountParts[0]}.${amountParts.slice(1).join('')}`; // Join decimals back
     } else if (amountParts.length === 2 && amountParts[1] === '') {
          cleanedAmount = amountParts[0]; // Handle trailing dot
     } else if (amountParts.length === 1 && cleanedAmount.endsWith('.')){
         cleanedAmount = cleanedAmount.slice(0,-1); // Remove trailing dot if no decimals
     }


     // 3. Ensure Shipper and Consignee are objects and initialize missing fields
      // Pass the potentially problematic output directly to the robust initializeAddress
      const finalShipper = initializeAddress(output.shipper);
      const finalConsignee = initializeAddress(output.consignee);


     // 4. Construct the final, cleaned output object
     const result: ExtractRateConDataOutput = {
       loadNumber: output.loadNumber ?? '',
       shipper: finalShipper,
       consignee: finalConsignee,
       weight: cleanedWeight,
       amount: cleanedAmount,
       truckNumber: output.truckNumber ?? '',
     };

     console.log("Final Cleaned Output:", result); // Log the final cleaned result
     return result;
  }
);
