# City One — AI-Powered City Pulse Platform  

**Hackathon Project by Team MR.Robots**  
_An intelligent real-time urban insight platform powered by AI and automation._

---

## Overview

City One is an AI-driven urban intelligence platform that provides citizens with a live, actionable, and predictive view of their city.  
It integrates data from multiple real-time sources such as traffic APIs, social media sentiment, EV hub status, and community reports to present unified insights that improve navigation, decision-making, and civic engagement.

---

## Problem Statement

Modern cities generate massive amounts of data from sensors, social media, and citizen inputs, but this information is fragmented, redundant, and often difficult to interpret.  
City One solves this by unifying data from diverse sources, reducing noise through clustering and NLP, and providing a single platform for real-time, predictive urban insights.

---

## Key Features

**Live Traffic Insights**  
- Displays real-time traffic conditions using live data APIs.  
- Interactive map visualization showing congestion levels.  
- Chatbot explanations for unusual traffic patterns.

**Live City Sentiment**  
- Fetches social media posts via n8n workflows.  
- Analyzes public sentiment using Gemini AI.  
- Displays city mood as polygon overlays on the map.

**EV Hub Status**  
- Shows live status of EV charging hubs across India.  
- Data dynamically updates through automated backend workflows.

**AI Chatbot (CityPulse AI)**  
- Built using n8n Webhooks and Gemini AI.  
- Responds to user queries based on real-time database insights.

**Community Help & Issue Reporting**  
- Allows citizens to submit local complaints.  
- Stores issues in Supabase with location and description.  
- Automatically generates acknowledgment messages using Gemini AI.

**Events Around India**  
- Displays ongoing and upcoming city events.  
- Helps users plan based on event density and sentiment in that area.

---

## Tech Stack

| Component | Technology |
|------------|-------------|
| Frontend | Next.js + Mapbox GL JS |
| Backend Automation | n8n Workflows |
| Database | Supabase |
| Sentiment Analysis | Gemini AI + NLP classification |
| Hosting | Supabase (DB) + Vercel/Netlify (Frontend) |

---

## System Workflow

**1. Social Media Sentiment Flow**  
- n8n fetches posts from Reddit/Twitter.  
- Gemini AI classifies sentiment.  
- Results stored in Supabase and visualized on the map.

**2. Chatbot Flow**  
- User query triggers n8n Webhook.  
- Gemini AI processes the query using database data.  
- Response returned to frontend chatbot.

**3. Community Help Flow**  
- User submits a report.  
- Data stored in Supabase.  
- Auto-response generated using Gemini AI.

---

## Team MR.Robots

| Name | Role | Contribution |
|------|------|---------------|
| Lakshwin Krishna Reddy M | AI & Backend Automation | n8n workflows, Gemini integration, Supabase schema |
| Mohamed Saif MS | Frontend Developer | Next.js + Mapbox dashboard, data visualization |
| Prathik E | Data Engineer | API integration, data cleaning, traffic data pipeline |
| Arunkumar P | UI/UX Designer | Dashboard design, user experience flow |

---

## Future Scope
- Integrate real-time crowd density estimation using image data.  
- Implement adaptive traffic signal control based on congestion.  
- Add predictive event analytics using LLMs.  
- Develop a mobile application version for accessibility.

---

## Conclusion

City One unifies AI, automation, and citizen collaboration into a single intelligent city platform.  
It enhances situational awareness, improves mobility, and empowers citizens with real-time, data-driven insights for better urban living.
