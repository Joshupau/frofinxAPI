// Calls reports_top_category_today (user-context, RLS-scoped) to get
// today's top spending category; if it already needs no AI call (no
// spending, uncategorized, or already cached today) returns directly.
// Otherwise calls Groq for a witty one-liner (falling back to a canned
// message on any failure) and writes it to finance_agent_cache via the
// service-role client — the one write path for that table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

const FALLBACK_INSIGHTS: Record<string, string[]> = {
  food: [
    `🍽️ Feast Mode Activated! You're treating yourself well with food today.`,
    `🥗 Your taste buds are winning – money well spent on flavors!`,
    `🍕 Food is your love language today. No regrets!`,
    `😋 You're fueling up like a champion today!`,
  ],
  groceries: [
    `🛒 Grocery hall hero! Stocking up for the week ahead.`,
    `🥦 Smart shopping mode: active!`,
    `🛍️ Building that pantry fortress one item at a time.`,
  ],
  transport: [
    `🚗 On the move today! Your wheels are keeping busy.`,
    `🛣️ Miles and smiles – your commute is real!`,
    `✈️ Your transportation fund is getting the workout today.`,
  ],
  entertainment: [
    `🎬 Entertainment is calling the shots today – let the fun begin!`,
    `🎮 You're investing in good times and great memories.`,
    `🎭 Life's too short not to have fun. Love the energy!`,
    `🎪 Fun budget activated! You deserve it.`,
  ],
  shopping: [
    `🛍️ Retail therapy in full swing! Treat yourself!`,
    `💳 Shopping spree champion – living your best life!`,
    `👜 You know what you want, and you got it!`,
    `🎁 Retail weekend energy!`,
  ],
  utilities: [
    `⚡ Keeping the lights on and the WiFi flowing – essentials locked!`,
    `🏠 Home sweet home costs add up, but worth it!`,
    `💡 Necessity spending – keeping life comfortable.`,
  ],
  health: [
    `💪 Investing in your health – that's always a win!`,
    `⚕️ Self-care priority mode engaged!`,
    `🏥 Health first – you're doing great!`,
  ],
  subscription: [
    `📺 Content is king – your subscriptions keep you entertained.`,
    `🎵 Streaming your life away (and loving it)!`,
    `📱 Digital lifestyle – staying connected and entertained.`,
  ],
};

function getFallbackInsight(
  categoryName: string,
  amount: number,
  transactionCount: number,
  percentageOfDay: number,
): string {
  const category = categoryName.toLowerCase();
  let categoryInsights: string[] = [];
  for (const [key, msgs] of Object.entries(FALLBACK_INSIGHTS)) {
    if (category.includes(key) || key.includes(category.split(" ")[0])) {
      categoryInsights = msgs;
      break;
    }
  }
  const genericInsights = [
    `💰 "${categoryName}" is claiming the MVP trophy – ${percentageOfDay.toFixed(1)}% of your spending power!`,
    `🎯 All-in on "${categoryName}" mode today – ${amount} spent and thriving!`,
    `🔥 "${categoryName}" is the main character of your wallet right now!`,
    `📊 Game changer: "${categoryName}" just became your top expense today!`,
    `⚡ You're ${transactionCount === 1 ? "committed to" : "all-in on"} "${categoryName}" – that's determination!`,
  ];
  const pool = categoryInsights.length > 0 ? categoryInsights : genericInsights;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function generateAIInsight(
  categoryName: string,
  amount: number,
  transactionCount: number,
  percentageOfDay: number,
  descriptions?: string[],
): Promise<string> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return getFallbackInsight(categoryName, amount, transactionCount, percentageOfDay);

  try {
    const descriptionContext = descriptions && descriptions.length > 0
      ? `\nRecent Transactions:\n${descriptions.slice(0, 5).map((d, i) => `${i + 1}. ${d}`).join("\n")}`
      : "";

    const prompt = `You are a funny, uplifting financial assistant. Generate a SHORT (1 sentence max), witty spending insight for a user.

Category: ${categoryName}
Amount: $${amount}
Transactions: ${transactionCount}
% of Day's Spending: ${percentageOfDay.toFixed(1)}%${descriptionContext}

Requirements:
- Be creative and fun, not generic
- Include a relevant emoji
- Make it feel like a "game changer" moment
- Keep it under 10 words after emoji
- Be specific to the category and amount
- Sound like you're cheering them on

Example format: "🎮 Gaming legend unlocked - weekend vibes activated!"

Generate ONLY the insight, no explanations.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.8,
      }),
    });

    if (!response.ok) return getFallbackInsight(categoryName, amount, transactionCount, percentageOfDay);

    const data = await response.json();
    const insight = data.choices?.[0]?.message?.content?.trim();
    return insight || getFallbackInsight(categoryName, amount, transactionCount, percentageOfDay);
  } catch (err) {
    console.error("Groq call failed:", err);
    return getFallbackInsight(categoryName, amount, transactionCount, percentageOfDay);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing Authorization header." }, 401);

    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { walletId } = await req.json().catch(() => ({ walletId: null }));

    const { data: top, error } = await client.rpc("reports_top_category_today", {
      p_wallet_id: walletId ?? null,
    });
    if (error) throw error;

    if (!top.needsInsight) {
      return jsonResponse(top);
    }

    const insight = await generateAIInsight(
      top.categoryName,
      top.totalSpent,
      top.transactionCount,
      top.percentageOfDay,
      top.descriptions,
    );

    const { data: userRes } = await client.auth.getUser();
    const ownerId = userRes.user?.id;

    if (ownerId) {
      const admin = supabaseAdmin();
      await admin.from("finance_agent_cache").insert({
        owner_id: ownerId,
        wallet_id: top.walletId ?? null,
        category_key: top.categoryId ?? "",
        description: insight,
      });
    }

    return jsonResponse({ ...top, insight });
  } catch (err) {
    console.error("finance-insight error:", err);
    return jsonResponse({ error: "Failed to generate insight." }, 500);
  }
});
