'use server';
/**
 * @fileOverview This file defines a Genkit flow for extracting data from Rate Con documents using OCR and NLP.
 *
 * - extractRateConData - A function that takes an image of a Rate Con document and returns the extracted data.
 * - ExtractRateConDataInput - The input type for the extractRateConData function, which is an image data URI.
 * - ExtractRateConDataOutput - The output type for the extractRateConData function, which contains the extracted fields.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {performOcr} from '@/services/ocr';

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
  truckNumber: z.string().optional().describe('The truck number from the Rate Con document, if available.'),
});
export type ExtractRateConDataOutput = z.infer<typeof ExtractRateConDataOutputSchema>;

export async function extractRateConData(input: ExtractRateConDataInput): Promise<ExtractRateConDataOutput> {
  return extractRateConDataFlow(input);
}

const extractRateConDataPrompt = ai.definePrompt({
  name: 'extractRateConDataPrompt',
  input: {
    schema: z.object({
      ocrText: z.string().describe('The OCR text extracted from the Rate Con document.'),
    }),
  },
  output: {
    schema: ExtractRateConDataOutputSchema,
  },
  prompt: `You are an expert data extraction specialist, skilled at extracting information from Rate Confirmation documents.

  Given the following OCR text from a Rate Con document, extract the following fields:

  - Load Number
  - Shipper
  - Consignee
  - Weight
  - Amount
  - Truck Number (if available)

  OCR Text: {{{ocrText}}}

  Return the extracted data in JSON format.  If a field is not available, leave it blank.  Do not add any additional text to the output.  Make sure the outputted JSON is parseable.  Be as accurate as possible.
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
    const ocrResult = await performOcr(input.photoDataUri);
    const {output} = await extractRateConDataPrompt({
      ocrText: ocrResult.text,
    });
    return output!;
  }
);
