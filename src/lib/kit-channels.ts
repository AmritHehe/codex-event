/** IDs match the distribution catalog. Copy generation never posts to a channel. */
export const KIT_CHANNELS = [
  { id: "x", label: "X thread", guidance: "A thread of 3 to 5 posts separated by blank lines, each at most 280 characters. Put the product link in the last post." },
  { id: "linkedin-personal", label: "LinkedIn post", guidance: "A founder story with a hook, concrete benefits, and a call to action. At most 200 words." },
  { id: "product-hunt", label: "Product Hunt tagline", guidance: "One descriptive tagline of at most 60 characters. No hashtags or invented superlatives." },
  { id: "instagram", label: "Reels caption", guidance: "A short Reels caption with a hook and call to action, plus 3 to 5 relevant hashtags in the hashtags field." },
  { id: "tiktok", label: "TikTok caption", guidance: "A conversational caption under 150 characters, plus 3 to 5 relevant hashtags in the hashtags field." },
] as const;
