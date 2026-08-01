"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { GuestPeek } from "@/components/GuestGate";
import { useAuthUser } from "@/components/AppShell";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function KoanChat() {
  const user = useAuthUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [resent, setResent] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function resendVerification() {
    try {
      await api.auth.resendVerification();
      setResent(true);
    } catch {
      /* rate limited — the button stays, they can retry in a minute */
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [input]);

  async function send() {
    if (!input.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Fire-and-forget usage tracking for the home-page widget.
    void api.koan.bump().catch(() => {});

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      // /api/chat is proxied by next.config.js to the FastAPI backend, which
      // streams Claude's reply as plain-text chunks.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: newMessages }),
      });

      if (res.status === 429) {
        // Rate limited: show the server's message instead of streaming.
        const detail = await res
          .json()
          .then((d) => d?.detail as string | undefined)
          .catch(() => undefined);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: detail || "Enough for now. Come back in a while.",
          };
          return updated;
        });
        return;
      }
      if (!res.ok) {
        throw new Error(await res.text().catch(() => "request failed"));
      }
      if (!res.body) throw new Error("No body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: text };
          return updated;
        });
      }
      text += decoder.decode();
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: text };
        return updated;
      });
    } catch (e) {
      console.error(e);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Something dissolved.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const content = (
    <>
      <header>
        <div className="title">Mirror</div>
        <div className="subtitle">What are you certain of?</div>
      </header>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty">
            <div className="empty-text">
              The mirror is ready.
              <br />
              Bring your certainties.
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="msg-label">
                {m.role === "user" ? "you" : "mirror"}
              </div>
              <div className="msg-text">
                {m.content}
                {streaming &&
                  i === messages.length - 1 &&
                  m.role === "assistant" && <span className="cursor" />}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {user && !user.emailVerified ? (
        // Logged in but unverified: the chat spends real money, so it opens
        // only after the emailed link is clicked (403 from the API anyway).
        <div className="input-area">
          <div className="guest-gate">
            <div className="guest-gate-title">Verify your email to open the mirror</div>
            <p className="guest-gate-text">
              {resent
                ? `A fresh link is on its way to ${user.email}.`
                : `We sent a link to ${user.email} when you signed up — click it and the mirror opens.`}
            </p>
            <div className="guest-gate-actions">
              <button onClick={resendVerification} disabled={resent}>
                {resent ? "Sent" : "Resend the link"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="input-area">
          <div className="input-row">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="State something you know to be true..."
              rows={1}
              disabled={streaming}
            />
            <button onClick={send} disabled={!input.trim() || streaming}>
              {streaming ? "..." : "Ask"}
            </button>
          </div>
          <div className="hint">enter to send · shift+enter for new line</div>
          <div className="crisis-note">
            a philosophical toy, not support — if you&apos;re struggling, call or
            text 988
          </div>
        </div>
      )}
    </>
  );

  // Guests see the real page under an interaction shield (sneak peek).
  return user === null ? (
    <GuestPeek feature="The mirror">{content}</GuestPeek>
  ) : (
    content
  );
}
