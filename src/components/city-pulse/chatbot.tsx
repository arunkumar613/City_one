"use client";

import React from "react";
import { toast } from "@/components/ui/use-toast"; // optional, remove if not available

type Message = {
  id: string;
  from: "user" | "bot";
  text: string;
  time?: number;
};

export default function ChatBot() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>(() => [
    {
      id: "welcome",
      from: "bot",
      text: "Hi — ask me about the map, EV hubs, or local events. I will forward your question to the backend.",
      time: Date.now(),
    },
  ]);

  const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

  const addMessage = (m: Message) => setMessages((s) => [...s, m].slice(-200)); // keep last 200

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    addMessage({
      id: String(Date.now()),
      from: "user",
      text,
      time: Date.now(),
    });
    setInput("");
    if (!webhookUrl) {
      addMessage({
        id: `err-${Date.now()}`,
        from: "bot",
        text: "Configuration error: missing NEXT_PUBLIC_N8N_WEBHOOK_URL",
        time: Date.now(),
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const textBody = await res.text();
        addMessage({
          id: `err-${Date.now()}`,
          from: "bot",
          text: `Webhook error: ${res.status} ${res.statusText} — ${textBody}`,
          time: Date.now(),
        });
      } else {
        const contentType = res.headers.get("content-type") || "";
        let body: any;
        if (contentType.includes("application/json")) {
          body = await res.json();
        } else {
          body = await res.text();
        }

        // n8n webhook responds with { "Response": "..." }
        let reply = "No reply";
        if (body && typeof body === "object" && "Response" in body) {
          reply = String(body.Response);
        } else if (typeof body === "string") {
          reply = body;
        } else if (body && body.reply) {
          reply = body.reply;
        } else if (body && body.text) {
          reply = body.text;
        } else if (body && body.message) {
          reply = body.message;
        } else if (
          Array.isArray(body) &&
          body.length > 0 &&
          (body[0].reply || body[0].text)
        ) {
          reply = body[0].reply || body[0].text;
        } else {
          try {
            reply = JSON.stringify(body);
          } catch {
            reply = "Unrecognized webhook response";
          }
        }

        addMessage({
          id: `bot-${Date.now()}`,
          from: "bot",
          text: reply,
          time: Date.now(),
        });
      }
    } catch (err: any) {
      addMessage({
        id: `err-${Date.now()}`,
        from: "bot",
        text: `Request failed: ${err?.message ?? String(err)}`,
        time: Date.now(),
      });
    } finally {
      setSending(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div>
      {/* Floating button */}
      <button
        aria-label="Open chat"
        onClick={() => setOpen((s) => !s)}
        className="fixed right-5 bottom-5 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
      >
        {/* simple chat icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-7 h-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 15a4 4 0 01-4 4H7l-4 4V5a4 4 0 014-4h10a4 4 0 014 4z"
          />
        </svg>
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed right-5 bottom-20 z-50 w-80 max-h-[60vh] bg-card/95 backdrop-blur-md rounded-lg border border-border shadow-xl flex flex-col overflow-hidden">
          <div className="px-3 py-2 bg-gradient-to-b from-background/80 to-transparent border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">Assistant</div>
            <button
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground"
            >
              Close
            </button>
          </div>

          <div
            className="p-3 overflow-y-auto flex-1 space-y-3"
            id="chat-scroll"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.from === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[78%] p-2 rounded-md text-sm ${
                    m.from === "user"
                      ? "bg-primary/80 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-border bg-background/60 flex items-center gap-2">
            <input
              aria-label="Message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask the assistant..."
              className="flex-1 rounded-md px-3 py-2 bg-input border border-border text-sm"
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={sending}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
