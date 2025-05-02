'use server';
/**
 * @fileOverview This file defines a Genkit flow for extracting data from Rate Con documents using image analysis.
 *
 * - extractRateConData - A function that takes an image of a Rate Con document and returns the extracted data.
 * - ExtractRateConDataInput - The input type for the extractRateConData function, which is an image data URI.
 * - ExtractRateConDataOutput - The output type for the extractRateConData function, which contains the extracted fields.
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

const ExtractRateConDataOutputSchema = z.object({
  loadNumber: z.string().describe('The load number from the Rate Con document.'),
  shipper: z.string().describe('The shipper from the Rate Con document.'),
  consignee: z.string().describe('The consignee from the Rate Con document.'),
  weight: z.string().describe('The weight from the Rate Con document.'),
  amount: z.string().describe('The amount from the Rate Con document.'),
  truckNumber: z.string().optional().describe('The truck number from the Rate Con document, if available. Often found near the top middle of the document.'),
});
export type ExtractRateConDataOutput = z.infer<typeof ExtractRateConDataOutputSchema>;

export async function extractRateConData(input: ExtractRateConDataInput): Promise<ExtractRateConDataOutput> {
  return extractRateConDataFlow(input);
}

const extractRateConDataPrompt = ai.definePrompt({
  name: 'extractRateConDataPrompt',
  input: {
    schema: ExtractRateConDataInputSchema, // Input is now the image data URI
  },
  output: {
    schema: ExtractRateConDataOutputSchema,
  },
  prompt: `You are an expert data extraction specialist, skilled at extracting information from Rate Confirmation documents using image analysis.

  Analyze the provided image of a Rate Con document and extract the following fields:

  - Load Number
  - Shipper
  - Consignee
  - Weight
  - Amount
  - Truck Number (if available - note: this is often located near the top middle of the document)

  Image: {{media url=photoDataUri}}

  Return the extracted data in JSON format. If a field is not clearly visible or identifiable in the image, leave it blank or as an empty string. Do not add any additional text to the output. Make sure the outputted JSON is parseable. Be as accurate as possible based on the image content.
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
    return output;
  }
);
