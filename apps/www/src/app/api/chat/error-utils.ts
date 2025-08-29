// Centralized helpers for error normalization and HTTP responses

export function toErrorMessage(err: unknown): string {
  try {
    if (err instanceof Error) return err.message || "";
    if (typeof err === "string") return err;
    return JSON.stringify(err);
  } catch {
    return "Unknown error occurred";
  }
}

export function isNoStreamingError(err: unknown): boolean {
  const msg = toErrorMessage(err).toLowerCase();
  // Also check responseBody if present
  // biome-ignore lint/suspicious/noExplicitAny: provider error shape
  const responseBody: string | undefined = (err as any)?.responseBody;
  const body = (responseBody || "").toLowerCase();
  return (
    msg.includes("does not support streaming") ||
    msg.includes("not support streaming") ||
    msg.includes("streaming is not supported") ||
    body.includes("does not support streaming") ||
    body.includes("not support streaming") ||
    body.includes("streaming is not supported")
  );
}

export function errorResponseForChat(err: unknown, modelId: string) {
  const errorMessage = toErrorMessage(err);

  // Common buckets mapped to clear client errors
  if (errorMessage.includes("not supported") || errorMessage.includes("Bad Request")) {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Used-Gateway": "unknown",
    });
    return new Response(
      JSON.stringify({
        error: `Model "${modelId}" is not supported by the LLM Gateway. Please select a different model.`,
        code: "MODEL_NOT_SUPPORTED",
        usedGateway: "unknown",
      }),
      { status: 400, headers }
    );
  }

  if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate limit")) {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Used-Gateway": "unknown",
    });
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Please wait a moment and try again.",
        code: "RATE_LIMITED",
        usedGateway: "unknown",
      }),
      { status: 429, headers }
    );
  }

  if (errorMessage.toLowerCase().includes("quota") || errorMessage.toLowerCase().includes("insufficient")) {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Used-Gateway": "unknown",
    });
    return new Response(
      JSON.stringify({
        error: "API quota exceeded. Please check your API key limits.",
        code: "QUOTA_EXCEEDED",
        usedGateway: "unknown",
      }),
      { status: 402, headers }
    );
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    "X-Used-Gateway": "unknown",
    "Cache-Control": "no-store",
  });
  return new Response(
    JSON.stringify({
      error: "Internal server error",
      details: errorMessage || "Unknown error occurred",
      usedGateway: "unknown",
    }),
    { status: 500, headers }
  );
}
