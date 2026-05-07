import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export type SalesScenario = 'initial_outreach' | 'follow_up' | 'objection_handling' | 'special_offer';

export async function generateContent(lead: any, type: 'whatsapp' | 'email', scenario: SalesScenario = 'initial_outreach') {
  const websiteInfo = lead.hasWebsite && lead.websiteUrl 
    ? `They have a website at ${lead.websiteUrl}.` 
    : lead.hasWebsite 
      ? 'They have a website.' 
      : 'They do not have a website.';

  const scenarioPrompts: Record<SalesScenario, string> = {
    initial_outreach: "initiate a professional conversation and introduce our services",
    follow_up: "follow up on our previous conversation and check if they have any questions",
    objection_handling: "address common concerns and provide reassurance about our value proposition",
    special_offer: "present a limited-time special offer or discount to incentivize a decision"
  };

  const basePrompt = type === 'whatsapp'
    ? `Generate a professional, personalized WhatsApp message to a lead for a business named "${lead.businessName}" located in "${lead.cityCountry}". ${websiteInfo} Use the website URL context if available to make the message highly relevant to their services.`
    : `Generate a professional, personalized email to a lead for a business named "${lead.businessName}" located in "${lead.cityCountry}". ${websiteInfo} Use the website URL context if available to mention specific insights or services they might offer.`;

  const finalPrompt = `${basePrompt} The goal is to ${scenarioPrompts[scenario]}. Keep it ${type === 'whatsapp' ? 'concise, friendly' : 'professional, engaging'}, and tailored to the context.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: finalPrompt,
  });
  
  return response.text;
}
