import arcjet, { shield, detectBot, tokenBucket, slidingWindow } from "@arcjet/node";

if(!process.env.ARCJET_KEY && process.env.NODE_ENV !== "test") {
  throw new Error("ARCJET_KEY environment variable is not set");
}

const aj = arcjet({
  
  key: process.env.ARCJET_KEY!,
  rules: [
    
    shield({ mode: "LIVE" }),

    detectBot({
      mode: "LIVE", 
     
      allow: [
        "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
        "CATEGORY:PREVIEW", // Link previews e.g. Slack, Discord
      ],
    }),
    // Create a slding window rate limit. Other algorithms are supported.
    slidingWindow({
      mode: 'LIVE',
      interval: '2s',
      max: 5, 
    }),
    ],
});

export default aj;