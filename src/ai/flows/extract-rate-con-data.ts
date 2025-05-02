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
  name: z.string().optional().describe('The name of the company or location.'),
  address: z.string().optional().describe('The street address.'),
  city: z.string().optional().describe('The city.'),
  state: z.string().optional().describe('The state or province abbreviation (e.g., CA, TX).'),
  zipCode: z.string().optional().describe('The postal or ZIP code.'),
}).describe('Structured address information. Ensure each field contains only the relevant text for that part of the address.');


const ExtractRateConDataOutputSchema = z.object({
  loadNumber: z.string().optional().describe('The load number from the Rate Con document.'),
  shipper: AddressSchema.optional().describe('The structured address information for the shipper. Return a JSON object, not the string "[object Object]".'),
  consignee: AddressSchema.optional().describe('The structured address information for the consignee. Return a JSON object, not the string "[object Object]".'),
  weight: z.string().optional().describe('The weight from the Rate Con document. Extract only the numeric value, excluding units like "lbs" or commas.'),
  amount: z.string().optional().describe('The amount from the Rate Con document. Extract only the numeric value, excluding currency symbols (like "$", "USD") or commas.'),
  truckNumber: z.string().optional().describe('The truck number from the Rate Con document, if available. Often found near the top middle of the document.'),
});
export type ExtractRateConDataOutput = z.infer<typeof ExtractRateConDataOutputSchema>;

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
  prompt: `You are an expert data extraction specialist, skilled at extracting information from Rate Confirmation documents using image analysis.

  Analyze the provided image of a Rate Con document and extract the following fields:

  - Load Number: The identifier for the load.
  - Shipper: Extract Name, Address, City, State, and Zip Code separately into a structured JSON object. DO NOT return the literal string "[object Object]".
  - Consignee: Extract Name, Address, City, State, and Zip Code separately into a structured JSON object. DO NOT return the literal string "[object Object]".
  - Weight: Extract **only the numerical value** for the weight. Exclude any units (like "lbs") or commas. Example: if the document says "48,000 lbs", extract "48000".
  - Amount: Extract **only the numerical value** for the amount. Exclude any currency symbols (like "$", "USD") or commas. Example: if the document says "USD 1,500.00", extract "1500.00" or "1500".
  - Truck Number: If available, extract the truck number. This is often located near the top middle of the document.

  Image: {{media url=photoDataUri}}

  Return the extracted data in JSON format strictly according to the specified output schema.
  For Shipper and Consignee, provide the information as a nested JSON object with fields: name, address, city, state, zipCode.
  If any specific field (like load number, weight, amount, truck number, or any address component like city or zipCode) is not clearly visible or identifiable in the image, return null or an empty string for that specific field within the JSON structure. Do not invent information.
  The output must be a single, valid, parseable JSON object conforming exactly to the schema, with no extra text before or after it.
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
  async input => {
    // Directly call the prompt with the image data URI
    const {output} = await extractRateConDataPrompt(input);
    // Ensure output is not null or undefined before returning
    if (!output) {
      throw new Error("Failed to generate output from the prompt.");
    }

    // Basic validation/cleaning, though the LLM should handle this based on the prompt.
    // Ensure shipper/consignee are objects. Handle if LLM mistakenly returns non-object.
    const cleanOutput = { ...output };
    if (typeof cleanOutput.shipper !== 'object' || cleanOutput.shipper === null) {
        cleanOutput.shipper = {};
    }
     if (typeof cleanOutput.consignee !== 'object' || cleanOutput.consignee === null) {
        cleanOutput.consignee = {};
     }

     // Optional: Further clean weight/amount if needed, but prompt aims for numeric strings.
     // Example: cleanOutput.weight = cleanOutput.weight?.replace(/[^0-9.]/g, '');
     // Example: cleanOutput.amount = cleanOutput.amount?.replace(/[^0-9.]/g, '');


     // Ensure shipper and consignee are objects even if empty before returning
     const result = {
       ...cleanOutput,
       shipper: cleanOutput.shipper ?? {},
       consignee: cleanOutput.consignee ?? {},
     };
     return result;
  }
);
