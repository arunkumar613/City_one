"use client";

import React from "react";

type CommunityHelpProps = {
  mapRef?: React.RefObject<any>;
  // when provided, treat open as controlled
  open?: boolean;
  onClose?: () => void;
  // render panel inline (no floating button) when true
  inline?: boolean;
};

export default function CommunityHelp({
  mapRef,
  open: controlledOpen,
  onClose,
  inline = false,
}: CommunityHelpProps) {
  // internal open state only used when not controlled
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open =
    typeof controlledOpen === "boolean" ? controlledOpen : internalOpen;

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [area, setArea] = React.useState("");
  const [lat, setLat] = React.useState<string>("");
  const [lng, setLng] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  // only send to n8n; n8n will handle persistence
  const webhook = process.env.NEXT_PUBLIC_N8N_COMMUNITY_WEBHOOK_URL;

  // optional: fill coords from map center when opening
  React.useEffect(() => {
    if (!open || !mapRef?.current) return;
    try {
      const m = mapRef.current.getMap?.() ?? mapRef.current;
      const center = m?.getCenter?.();
      if (center) {
        setLng(String(center.lng || center[0] || ""));
        setLat(String(center.lat || center[1] || ""));
      }
    } catch {
      // ignore
    }
  }, [open, mapRef]);

  const clear = () => {
    setTitle("");
    setDescription("");
    setArea("");
    setLat("");
    setLng("");
  };

  const close = () => {
    if (typeof controlledOpen === "boolean") {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  // helper: geocode an area string via Mapbox (returns [lat, lng] or null)
  async function geocodeArea(query: string): Promise<[number, number] | null> {
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token || !query) return null;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?limit=1&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("Geocoding failed", res.status, res.statusText);
        return null;
      }
      const data = await res.json();
      const feature = data?.features?.[0];
      if (!feature || !feature.center) return null;
      const [lng, lat] = feature.center;
      return [lat, lng];
    } catch (err) {
      console.warn("Geocode error", err);
      return null;
    }
  }

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || !description.trim()) {
      return alert("Please provide a title and description");
    }

    if (!webhook) {
      console.error("NEXT_PUBLIC_N8N_COMMUNITY_WEBHOOK_URL is not set!");
      alert("Webhook not configured. Contact admin.");
      return;
    }

    setSubmitting(true);

    // derive numeric coords: prefer explicit inputs, otherwise try geocoding the area
    let finalLat: number | null = lat ? Number(lat) : null;
    let finalLng: number | null = lng ? Number(lng) : null;

    if ((!finalLat || !finalLng) && area.trim()) {
      const coords = await geocodeArea(area.trim());
      if (coords) {
        finalLat = coords[0];
        finalLng = coords[1];
        // update UI fields so user can see them
        setLat(String(finalLat));
        setLng(String(finalLng));
        console.log("Geocoded area to:", finalLat, finalLng);
      } else {
        console.log("Geocoding returned no results for area:", area);
      }
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      area: area.trim() || null,
      lat: finalLat,
      lng: finalLng,
    };

    console.log("Posting community payload to webhook:", webhook, payload);

    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("Webhook response status:", res.status, res.statusText);
      const contentType = res.headers.get("content-type") || "";
      let body: any = null;
      try {
        body = contentType.includes("application/json")
          ? await res.json()
          : await res.text();
        console.log("Webhook response body:", body);
      } catch (parseErr) {
        console.warn("Failed to parse webhook response", parseErr);
      }

      if (!res.ok) {
        console.error("n8n webhook returned error:", res.status, body);
        const errText = typeof body === "string" ? body : JSON.stringify(body);
        alert(`Failed to send to webhook: ${res.status} ${res.statusText}`);
      } else {
        let serverMsg = "Submitted to webhook";
        if (body && typeof body === "object" && "Response" in body) {
          serverMsg = String(body.Response);
        } else if (typeof body === "string") {
          serverMsg = body;
        } else if (body && (body.message || body.reply || body.text)) {
          serverMsg = body.message ?? body.reply ?? body.text;
        }
        console.log("n8n webhook response:", body);
        alert(serverMsg);
      }
    } catch (err) {
      console.error("n8n webhook error", err);
      alert("Failed to send to webhook. See console for details.");
    } finally {
      setSubmitting(false);
      clear();
      close();
      // final confirmation
      // (n8n may already have returned a Response field)
      // keep local confirmation brief
      // alert removed to avoid duplicate if webhook responded with message
    }
  };

  return (
    <>
      {!inline && (
        <button
          aria-label="Community help"
          onClick={() => {
            if (typeof controlledOpen === "boolean") {
              onClose?.();
            } else {
              setInternalOpen((s) => !s);
            }
          }}
          className="fixed right-5 bottom-20 z-50 w-12 h-12 rounded-full bg-slate-800 text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          title="Community help"
        >
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      )}

      {open && (
        <div
          className={
            inline
              ? "fixed right-4 top-20 z-20 bg-card/95 backdrop-blur-md rounded-lg border border-border shadow-xl flex flex-col overflow-hidden w-96 max-h-[70vh]"
              : "fixed right-5 bottom-36 z-50 w-96 max-h-[70vh] bg-card/95 backdrop-blur-md rounded-lg border border-border shadow-xl flex flex-col overflow-hidden"
          }
        >
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">Community Help</div>
            <button onClick={close} className="text-sm text-muted-foreground">
              Close
            </button>
          </div>

          <form
            onSubmit={onSubmit}
            className="p-3 overflow-y-auto flex-1 space-y-3"
          >
            <div>
              <label className="text-xs font-medium">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full mt-1 px-2 py-2 rounded-md bg-input border border-border text-sm"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full mt-1 px-2 py-2 rounded-md bg-input border border-border text-sm"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium">
                Area / Address (optional)
              </label>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full mt-1 px-2 py-2 rounded-md bg-input border border-border text-sm"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium">Latitude</label>
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full mt-1 px-2 py-2 rounded-md bg-input border border-border text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium">Longitude</label>
                <input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full mt-1 px-2 py-2 rounded-md bg-input border border-border text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  clear();
                  close();
                }}
                className="px-3 py-2 rounded-md text-sm border border-border"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Submit Report"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
