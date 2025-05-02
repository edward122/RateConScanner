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
}).describe('Structured address information.');


const ExtractRateConDataOutputSchema = z.object({
  loadNumber: z.string().optional().describe('The load number from the Rate Con document.'),
  shipper: AddressSchema.optional().describe('The structured address information for the shipper.'),
  consignee: AddressSchema.optional().describe('The structured address information for the consignee.'),
  weight: z.string().optional().describe('The weight from the Rate Con document.'),
  amount: z.string().optional().describe('The amount from the Rate Con document.'),
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

  - Load Number
  - Shipper (Extract Name, Address, City, State, and Zip Code separately)
  - Consignee (Extract Name, Address, City, State, and Zip Code separately)
  - Weight
  - Amount
  - Truck Number (if available - note: this is often located near the top middle of the document)

  Image: {{media url=photoDataUri}}

  Return the extracted data in JSON format according to the specified output schema.
  For Shipper and Consignee, provide the information as a nested JSON object with fields: name, address, city, state, zipCode.
  If any specific field (like load number, weight, amount, truck number, or any address component) is not clearly visible or identifiable in the image, return null or an empty string for that specific field. Do not make up information.
  Do not add any additional text to the output. Make sure the outputted JSON is parseable and strictly adheres to the schema. Be as accurate as possible based on the image content.
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
    // Ensure shipper and consignee are objects even if empty
     const result = {
       ...output,
       shipper: output.shipper ?? {},
       consignee: output.consignee ?? {},
     };
     return result;
  }
);
