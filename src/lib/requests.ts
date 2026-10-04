// Client-side helpers for calling the API.

/** The API's error message, if the response carried one. */
export async function errorOf(res: Response | null): Promise<string | null> {
  const body = await res?.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : null;
}

// Changes to a comment go out one at a time, in the order they were made. Each
// sends a whole value (the response, the assignee list), so an older request
// landing after a newer one would undo it.
const queues = new Map<string, Promise<Response | null>>();

/** PATCHes a comment once its earlier changes have landed; null if the request failed to send. */
export function patchComment(commentId: string, body: object): Promise<Response | null> {
  const request = (queues.get(commentId) ?? Promise.resolve(null)).then(() =>
    fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null)
  );
  queues.set(commentId, request);
  request.then(() => {
    if (queues.get(commentId) === request) queues.delete(commentId);
  });
  return request;
}
