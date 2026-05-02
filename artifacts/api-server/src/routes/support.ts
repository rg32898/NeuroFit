import { Router, type IRouter } from "express";
import { createTicketSchema } from "@workspace/shared/support";
import { requireAuth } from "../middlewares/requireAuth";
import { findUserById } from "../auth/userRepo";
import {
  createSupportTicket,
  findTicketByIdForUser,
} from "../support/supportRepo";
import { sendEmail } from "../services/notifications";

const router: IRouter = Router();

/**
 * POST /api/support/tickets
 *   Open a support ticket. Always sends a transactional acknowledgement email
 *   to the user (when an email is on file) so the inbox is the system of
 *   record from the user's side. Marketing-opt-in is NOT consulted — this is
 *   a transactional send (ticket lifecycle), not marketing (FR-8.4).
 */
router.post("/tickets", requireAuth, async (req, res) => {
  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid ticket payload",
        issues: parsed.error.flatten(),
        requestId: req.id ?? null,
      },
    });
    return;
  }

  const userId = req.user!.id;
  const ticket = await createSupportTicket({ userId, ...parsed.data });

  req.log?.info(
    { ticketId: ticket.id, category: ticket.category },
    "support.ticket.created",
  );

  // Best-effort acknowledgement email. Don't block the response if it fails.
  const ack = await findUserById(userId);
  if (ack?.user.email) {
    const ref = ticket.id.slice(0, 8);
    await sendEmail({
      userId,
      to: ack.user.email,
      subject: `[NeuroFit] We received your message — #${ref}`,
      html: `
        <p>Thanks for reaching out — we got your message and will get back to you shortly.</p>
        <p><strong>Reference:</strong> ${ref}<br/>
           <strong>Subject:</strong> ${escapeHtml(ticket.subject)}</p>
        <p>If you need to add more detail, just reply to this email.</p>
      `,
      text: `Thanks for reaching out — we got your message (ref ${ref}) and will get back to you shortly.`,
      kind: "support_ack",
      template: "support_ack.v1",
    });
  }

  res.status(201).json({ ticket });
});

/**
 * GET /api/support/tickets/:id
 *   Status of a ticket the caller owns. We return 404 for both
 *   "doesn't exist" and "exists but isn't yours" — see supportRepo.
 */
router.get("/tickets/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string" || id.length === 0) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Ticket id required" },
    });
    return;
  }
  const ticket = await findTicketByIdForUser(id, req.user!.id);
  if (!ticket) {
    res.status(404).json({
      error: {
        code: "TICKET_NOT_FOUND",
        message: "Ticket not found",
        requestId: req.id ?? null,
      },
    });
    return;
  }
  res.json({ ticket });
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default router;
