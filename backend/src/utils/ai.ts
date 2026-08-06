import OpenAI from "openai";

type ProviderName = "nvidia" | "groq";

interface ProviderConfig {
  name: ProviderName;
  client: OpenAI | null;
  model: string;
  isThinkingModel: boolean;
  init: () => OpenAI;
}

let providers: ProviderConfig[] | null = null;

function getProviders(): ProviderConfig[] {
  if (!providers) {
    providers = [];

    // 1. NVIDIA DeepSeek V4 (Primary)
    if (process.env.NVIDIA_API_KEY) {
      providers.push({
        name: "nvidia",
        client: null,
        model: "meta/llama-3.1-70b-instruct",
        isThinkingModel: false,
        init: function () {
          if (!this.client) {
            this.client = new OpenAI({
              apiKey: process.env.NVIDIA_API_KEY,
              baseURL: "https://integrate.api.nvidia.com/v1",
            });
          }
          return this.client;
        },
      });
    }

    // 2. Groq Llama 3.3 70B (Fallback)
    if (process.env.GROQ_API_KEY) {
      providers.push({
        name: "groq",
        client: null,
        model: "llama-3.3-70b-versatile",
        isThinkingModel: false,
        init: function () {
          if (!this.client) {
            this.client = new OpenAI({
              apiKey: process.env.GROQ_API_KEY,
              baseURL: "https://api.groq.com/openai/v1",
            });
          }
          return this.client;
        },
      });
    }

    if (providers.length === 0) {
      throw new Error("No AI providers configured. Please set NVIDIA_API_KEY or GROQ_API_KEY.");
    }
  }
  return providers;
}

export interface GenerateOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Highly available completion wrapper. Will try Provider A, and instantly failover to Provider B
 * if there is a 429, 529, or if the request takes longer than 10000ms.
 */
export async function generateCompletion(opts: GenerateOptions): Promise<string> {
  const availableProviders = getProviders();
  let lastError: any = null;

  for (const provider of availableProviders) {
    const maxAttempts = provider.name === "nvidia" ? 2 : 1;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        console.log(`[ai] Attempting generation with provider: ${provider.name} (${provider.model}) (Attempt ${attempt}/${maxAttempts})`);
        const client = provider.init();

      const messages: any[] = [];
      if (opts.systemPrompt) {
        messages.push({ role: "system", content: opts.systemPrompt });
      }
      messages.push({ role: "user", content: opts.prompt });

      const requestPayload: any = {
        model: provider.model,
        messages,
        max_tokens: opts.maxTokens || 2000,
      };

      if (opts.jsonMode) {
        requestPayload.response_format = { type: "json_object" };
      }

      if (provider.isThinkingModel && provider.name === "nvidia") {
        requestPayload.chat_template_kwargs = { thinking: true, reasoning_effort: "high" };
      }

      // 10000ms timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const completion = await client.chat.completions.create(requestPayload, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let rawText = completion.choices[0]?.message?.content || "{}";

      // Strip think tags if model returned reasoning
      rawText = rawText.replace(/<think>[\s\S]*?<\/think>/g, "");

      if (opts.jsonMode) {
        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          rawText = jsonMatch[0];
        }
      }

      return rawText;
    } catch (err: any) {
      lastError = err;
      const isAbort = err.name === "AbortError" || err.name === "APIUserAbortError" || err.message?.includes("aborted") || err.message?.includes("Timeout");
      
      const isRateLimitOrOverload = err?.status === 429 || err?.status === 529;

      if (isRateLimitOrOverload && attempt < maxAttempts) {
        console.warn(`[ai] Provider ${provider.name} returned ${err.status}. Retrying in 2000ms... (Attempt ${attempt}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (isAbort || isRateLimitOrOverload || err?.status >= 500) {
        console.warn(`[ai] Provider ${provider.name} failed (${isAbort ? 'Timeout' : err.status}). Falling back to next provider...`);
        break; // break the while loop, proceed to next provider
      }
      
      // If it's a 400 Bad Request (like max_tokens too high) or other hard error, don't fallback, just throw.
      throw err;
    }
    }
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message || String(lastError)}`);
}
