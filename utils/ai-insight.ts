/**
 * AI-powered spending insights using Groq API
 * Generates creative, engaging insights about user spending patterns
 * Falls back to hardcoded insights if API fails or times out
 */

// Fallback insights for when AI is unavailable
const FALLBACK_INSIGHTS: { [key: string]: string[] } = {
  food: [
    `🍽️ Feast Mode Activated! You're treating yourself well with food today.`,
    `🥗 Your taste buds are winning – money well spent on flavors!`,
    `🍕 Food is your love language today. No regrets!`,
    `😋 You're fueling up like a champion today!`
  ],
  groceries: [
    `🛒 Grocery hall hero! Stocking up for the week ahead.`,
    `🥦 Smart shopping mode: active!`,
    `🛍️ Building that pantry fortress one item at a time.`
  ],
  transport: [
    `🚗 On the move today! Your wheels are keeping busy.`,
    `🛣️ Miles and smiles – your commute is real!`,
    `✈️ Your transportation fund is getting the workout today.`
  ],
  entertainment: [
    `🎬 Entertainment is calling the shots today – let the fun begin!`,
    `🎮 You're investing in good times and great memories.`,
    `🎭 Life's too short not to have fun. Love the energy!`,
    `🎪 Fun budget activated! You deserve it.`
  ],
  shopping: [
    `🛍️ Retail therapy in full swing! Treat yourself!`,
    `💳 Shopping spree champion – living your best life!`,
    `👜 You know what you want, and you got it!`,
    `🎁 Retail weekend energy!`
  ],
  utilities: [
    `⚡ Keeping the lights on and the WiFi flowing – essentials locked!`,
    `🏠 Home sweet home costs add up, but worth it!`,
    `💡 Necessity spending – keeping life comfortable.`
  ],
  health: [
    `💪 Investing in your health – that's always a win!`,
    `⚕️ Self-care priority mode engaged!`,
    `🏥 Health first – you're doing great!`
  ],
  subscription: [
    `📺 Content is king – your subscriptions keep you entertained.`,
    `🎵 Streaming your life away (and loving it)!`,
    `📱 Digital lifestyle – staying connected and entertained.`
  ]
};

interface GroqMessage {
  role: 'user' | 'system';
  content: string;
}

/**
 * Generate AI-powered spending insight using Groq API
 * Falls back to hardcoded insights if API fails
 */
export const generateAIInsight = async (
  categoryName: string,
  amount: number,
  transactionCount: number,
  percentageOfDay: number,
  descriptions?: string[]
): Promise<string> => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.log('Groq API key not configured, using fallback insights');
      return getFallbackInsight(categoryName, amount, transactionCount, percentageOfDay);
    }

    const descriptionContext = descriptions && descriptions.length > 0
      ? `\nRecent Transactions:\n${descriptions.slice(0, 5).map((d, i) => `${i + 1}. ${d}`).join('\n')}`
      : '';

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

    const messages: GroqMessage[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages,
        max_tokens: 100,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      console.log(`Groq API error: ${response.status}, using fallback`);
      return getFallbackInsight(categoryName, amount, transactionCount, percentageOfDay);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const insight = data.choices?.[0]?.message?.content?.trim();

    if (!insight) {
      return getFallbackInsight(categoryName, amount, transactionCount, percentageOfDay);
    }

    return insight;
  } catch (err) {
    console.log(`Error generating AI insight: ${err}`);
    return getFallbackInsight(categoryName, amount, transactionCount, percentageOfDay);
  }
};

/**
 * Get fallback insight from hardcoded list
 */
function getFallbackInsight(
  categoryName: string,
  amount: number,
  transactionCount: number,
  percentageOfDay: number
): string {
  const category = categoryName.toLowerCase();

  // Try to find a matching category
  let categoryInsights: string[] = [];
  for (const [key, msgs] of Object.entries(FALLBACK_INSIGHTS)) {
    if (category.includes(key) || key.includes(category.split(' ')[0])) {
      categoryInsights = msgs;
      break;
    }
  }

  // Generic fallback insights
  const genericInsights: string[] = [
    `💰 "${categoryName}" is claiming the MVP trophy – ${percentageOfDay.toFixed(1)}% of your spending power!`,
    `🎯 All-in on "${categoryName}" mode today – ${amount} spent and thriving!`,
    `🔥 "${categoryName}" is the main character of your wallet right now!`,
    `📊 Game changer: "${categoryName}" just became your top expense today!`,
    `⚡ You're ${transactionCount === 1 ? 'committed to' : 'all-in on'} "${categoryName}" – that's determination!`
  ];

  const messagesToUse = categoryInsights.length > 0 ? categoryInsights : genericInsights;
  return messagesToUse[Math.floor(Math.random() * messagesToUse.length)];
}
