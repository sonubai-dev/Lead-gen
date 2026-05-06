import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateContent(lead: any, type: 'whatsapp' | 'email') {
  const websiteInfo = lead.hasWebsite && lead.websiteUrl 
    ? `They have a website at ${lead.websiteUrl}.` 
    : lead.hasWebsite 
      ? 'They have a website.' 
      : 'They do not have a website.';

  const prompt = type === 'whatsapp'
    ? `Generate a professional, personalized WhatsApp message to a lead for a business named "${lead.businessName}" located in "${lead.cityCountry}". ${websiteInfo} Use the website URL context if available to make the message highly relevant to their services. The message should aim to initiate a professional conversation. Keep it concise, friendly, and tailored to the context.`
    : `Generate a professional, personalized email to a lead for a business named "${lead.businessName}" located in "${lead.cityCountry}". ${websiteInfo} Use the website URL context if available to mention specific insights or services they might offer. The email should aim to initiate a professional conversation. Keep it professional, engaging, and tailored to the context.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
  
  return response.text;
}
