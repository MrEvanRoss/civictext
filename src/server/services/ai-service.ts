import OpenAI from "openai";

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI features require an OpenAI API key. Ask your administrator to add OPENAI_API_KEY in the environment settings.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const SYSTEM_PROMPT_CAMPAIGN = `You are an expert political SMS/MMS copywriter for campaign organizations. Your job is to generate concise, effective text messages.

Rules:
- Write SMS messages that are concise and under the specified character limit
- Follow political messaging best practices: clear call-to-action, personalization, urgency when appropriate
- Do NOT include opt-out language like "Reply STOP to opt out" — the platform appends this automatically
- Support merge fields like {{firstName}}, {{lastName}}, {{orgName}} for personalization
- Match the requested tone exactly
- Generate exactly 3 distinct variants with different approaches/angles
- Each variant should be a complete, ready-to-send message
- Do not number or label the variants — return them as separate messages`;

const SYSTEM_PROMPT_REPLY = `You are a helpful assistant for political campaign texting agents. You suggest short, human-sounding reply messages for inbound SMS conversations.

Rules:
- Keep replies concise (under 160 characters when possible)
- Sound natural and human, not robotic
- Be helpful and on-topic based on the conversation context
- Do NOT include opt-out language — the platform handles this
- Generate exactly 3 distinct reply suggestions
- If the contact shared their name, use it naturally
- Be politically neutral — match the tone of the organization's previous messages`;

const SYSTEM_PROMPT_IMPROVE = `You are an expert political SMS copywriter. Your job is to improve or rewrite text messages based on specific instructions.

Rules:
- Keep the improved message concise and suitable for SMS
- Do NOT include opt-out language — the platform handles this
- Follow the improvement instructions exactly
- Preserve merge fields like {{firstName}}, {{lastName}} if present in the original
- Return only the improved message text, nothing else`;

/**
 * Generate 3 campaign message variants using AI.
 */
export async function generateCampaignMessage(
  prompt: string,
  tone: string,
  maxLength: number,
  orgContext?: string
): Promise<string[]> {
  const client = getClient();

  try {
    const userPrompt = [
      `Generate 3 SMS message variants for the following request:`,
      ``,
      `Request: ${prompt}`,
      `Tone: ${tone}`,
      `Maximum length per message: ${maxLength} characters`,
      orgContext ? `Organization context: ${orgContext}` : "",
      ``,
      `Return exactly 3 variants, each on its own line, separated by "---" on its own line.`,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT_CAMPAIGN },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 1200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return ["Failed to generate message. Please try again."];

    // Parse the 3 variants separated by ---
    const variants = content
      .split(/\n---\n|\n-{3,}\n/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .slice(0, 3);

    if (variants.length === 0) {
      return [content]; // Fallback: return the whole response as one variant
    }

    // Truncate each variant to maxLength
    return variants.map((v) => (v.length > maxLength ? v.slice(0, maxLength) : v));
  } catch (error) {
    console.error("AI generation error:", error);
    throw new Error(`AI generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Suggest 3 reply messages based on conversation history.
 */
export async function suggestReplies(
  conversationHistory: { direction: string; body: string }[],
  contactInfo?: { firstName?: string }
): Promise<string[]> {
  const client = getClient();

  try {
    const historyText = conversationHistory
      .slice(-10) // Last 10 messages for context
      .map((msg) => `${msg.direction === "INBOUND" ? "Contact" : "Agent"}: ${msg.body}`)
      .join("\n");

    const userPrompt = [
      `Based on this conversation, suggest 3 reply options:`,
      ``,
      historyText,
      ``,
      contactInfo?.firstName
        ? `The contact's first name is ${contactInfo.firstName}.`
        : "",
      ``,
      `Return exactly 3 reply suggestions, each on its own line, separated by "---" on its own line.`,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT_REPLY },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return ["Failed to generate suggestions. Please try again."];

    const suggestions = content
      .split(/\n---\n|\n-{3,}\n/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .slice(0, 3);

    if (suggestions.length === 0) {
      return [content];
    }

    return suggestions;
  } catch (error) {
    console.error("AI suggestion error:", error);
    throw new Error(`AI suggestion failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Improve/rewrite a message based on instructions.
 */
export async function improveMessage(
  originalMessage: string,
  instruction: string
): Promise<string> {
  const client = getClient();

  try {
    const userPrompt = [
      `Original message:`,
      originalMessage,
      ``,
      `Instruction: ${instruction}`,
      ``,
      `Return only the improved message text.`,
    ].join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT_IMPROVE },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return "Failed to improve message. Please try again.";

    return content;
  } catch (error) {
    console.error("AI improve error:", error);
    throw new Error(`AI improvement failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
