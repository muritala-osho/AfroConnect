/**
 * Centralized Support System — backend/routes/support.js
 *
 * ONE unified support backend shared by:
 *   • User app   (create tickets, view own, reply, read unread count)
 *   • Admin      (view all, reply, assign, change status)
 *   • Agent      (view assigned, reply)
 *
 * Mounted at:  /api/support
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isAdmin, isAdminOrAgent } = require('../middleware/supportAccess');
const User = require('../models/User');
const SupportTicket = require('../models/SupportTicket');
const { sendExpoPushNotification, sendSmartNotification } = require('../utils/pushNotifications');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Send optional email alert to admin inbox (non-critical, never crashes a route) */
async function emailAdmin(subject, body) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) return;
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'AfroConnect', email: process.env.BREVO_SENDER_EMAIL },
        to: [{ email: process.env.BREVO_SENDER_EMAIL }],
        subject,
        textContent: body,
      }),
    });
  } catch (err) {
    console.error('[Support] Admin email failed (non-critical):', err.message);
  }
}

/** Push notification to a specific user's device (non-critical) */
async function pushToUser(userId, title, body, data = {}) {
  if (!userId) return;
  try {
    const user = await User.findById(userId).select(
      'pushToken pushNotificationsEnabled muteSettings notificationPreferences'
    );
    if (user?.pushToken) {
      await sendSmartNotification(user, { title, body, data, channelId: 'support' }, 'support');
    }
  } catch (err) {
    console.error('[Support] Push to user failed (non-critical):', err.message);
  }
}

/** Push notification to the assigned agent, or all admins if unassigned */
async function pushToStaff(ticket, title, body) {
  try {
    const query = ticket.assignedTo
      ? { _id: ticket.assignedTo }
      : { isAdmin: true };
    const staffList = await User.find(query).select('pushToken pushNotificationsEnabled');
    for (const staff of staffList) {
      if (staff?.pushToken && staff.pushNotificationsEnabled !== false) {
        await sendExpoPushNotification(staff.pushToken, {
          title,
          body,
          data: { screen: 'AdminSupport', ticketId: ticket._id.toString() },
          channelId: 'support',
        });
      }
    }
  } catch (err) {
    console.error('[Support] Push to staff failed (non-critical):', err.message);
  }
}

// ─── User endpoints ───────────────────────────────────────────────────────────

/**
 * POST /api/support/ticket
 * Create a new support ticket.
 * Works without auth (public contact form) or with auth (links to user account).
 */
router.post('/ticket', async (req, res) => {
  try {
    const { name, email, message, subject, category } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email and message are required' });
    }

    // Resolve userId exclusively from auth token — never trust userId from request body
    let resolvedUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        resolvedUserId = decoded.id;
      } catch (_) {}
    }

    const priorityMap = { billing: 'high', account: 'medium', technical: 'medium', safety: 'high', other: 'low' };
    const cat = category || 'other';

    const ticket = new SupportTicket({
      userId: resolvedUserId,
      userName: name,
      userEmail: email,
      subject: subject || 'Support Request',
      category: cat,
      priority: priorityMap[cat] || 'medium',
      status: 'open',
      unreadByAgent: 1,
      messages: [{
        role: 'user',
        content: message,
        senderName: name,
        senderId: resolvedUserId || undefined,
        timestamp: new Date(),
      }],
    });
    await ticket.save();

    // Notify staff of the new ticket
    await pushToStaff(ticket, '🎫 New Support Ticket', `${name}: ${subject || message.slice(0, 60)}`);
    await emailAdmin(
      `[AfroConnect Support] New Ticket from ${name}`,
      `Ticket ID: ${ticket._id}\nUser: ${name} (${email})\nCategory: ${cat}\n\nMessage:\n${message}`
    );

    res.json({ success: true, ticketId: ticket._id, message: "Ticket created. We'll reply within 24 hours." });
  } catch (error) {
    console.error('[Support] Create ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/** Legacy alias — old clients POST to /contact, route to /ticket handler */
router.post('/contact', async (req, res, next) => {
  req.url = '/ticket';
  return router.handle(req, res, next);
});

/**
 * GET /api/support/user
 * Get the authenticated user's own tickets.
 */
router.get('/user', protect, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(50);
    res.json({ success: true, tickets });
  } catch (error) {
    console.error('[Support] Get user tickets error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/support/ticket/:id
 * Fetch a single ticket with all messages.
 * - User can only fetch their own ticket.
 * - Agent can only fetch their assigned tickets.
 * - Admin can fetch any ticket.
 * Clears the unread counter for the caller's role.
 */
router.get('/ticket/:id', protect, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('assignedTo', 'name email');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const isStaff = req.user.isAdmin || req.user.isSupportAgent;

    if (!isStaff && String(ticket.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (req.user.isSupportAgent && !req.user.isAdmin) {
      if (ticket.assignedTo && String(ticket.assignedTo._id) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'This ticket is not assigned to you' });
      }
    }

    // Clear unread for the appropriate side
    const unreadUpdate = isStaff ? { unreadByAgent: 0 } : { unreadByUser: 0 };
    await SupportTicket.findByIdAndUpdate(req.params.id, unreadUpdate);

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('[Support] Get ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/support/unread
 * Total unread reply count for the authenticated user (drives badge in app).
 */
router.get('/unread', protect, async (req, res) => {
  try {
    const result = await SupportTicket.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: null, total: { $sum: '$unreadByUser' } } },
    ]);
    const count = result[0]?.total || 0;
    res.json({ success: true, count });
  } catch (error) {
    console.error('[Support] Unread count error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Shared reply endpoint (user / admin / agent) ─────────────────────────────

/**
 * POST /api/support/reply
 * Add a message to a ticket thread. Works for all three roles.
 * Body: { ticketId, content }
 */
router.post('/reply', protect, async (req, res) => {
  try {
    const { ticketId, content } = req.body;
    if (!ticketId || !content?.trim()) {
      return res.status(400).json({ success: false, message: 'ticketId and content are required' });
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Determine sender role
    let senderRole;
    if (req.user.isAdmin) senderRole = 'admin';
    else if (req.user.isSupportAgent) senderRole = 'agent';
    else senderRole = 'user';

    // Access control
    if (senderRole === 'user' && String(ticket.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (senderRole === 'agent' && !req.user.isAdmin) {
      if (ticket.assignedTo && String(ticket.assignedTo) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'This ticket is not assigned to you' });
      }
    }

    const isStaff = senderRole !== 'user';
    const displayName = req.user.name || (isStaff ? 'AfroConnect Support' : ticket.userName);

    ticket.messages.push({
      role: senderRole,
      content: content.trim(),
      senderName: displayName,
      senderId: req.user._id,
      adminName: isStaff ? displayName : undefined, // backward compat
      timestamp: new Date(),
    });

    if (isStaff) {
      // Staff replied — move to in-progress, increment user's unread badge
      if (ticket.status === 'open') ticket.status = 'in-progress';
      ticket.unreadByUser = (ticket.unreadByUser || 0) + 1;

      await pushToUser(ticket.userId, '💬 Support Reply', content.length > 80 ? content.slice(0, 80) + '…' : content, {
        screen: 'Support',
        ticketId: ticket._id.toString(),
      });

      // Email user
      if (ticket.userId) {
        try {
          const ticketUser = await User.findById(ticket.userId).select('email name');
          if (ticketUser?.email) {
            const { sendSupportReplyEmail } = require('../utils/emailService');
            await sendSupportReplyEmail(ticketUser.email, ticketUser.name, content.trim(), ticket.subject);
          }
        } catch (e) {
          console.error('[Support] Reply email failed (non-critical):', e.message);
        }
      }
    } else {
      // User replied — re-open if closed, increment staff unread
      if (ticket.status === 'closed') ticket.status = 'open';
      ticket.unreadByAgent = (ticket.unreadByAgent || 0) + 1;
      await pushToStaff(ticket, '💬 User Reply', `${ticket.userName}: ${content.slice(0, 60)}`);
    }

    await ticket.save();
    res.json({ success: true, ticket });
  } catch (error) {
    console.error('[Support] Reply error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Admin / Agent endpoints ──────────────────────────────────────────────────

/**
 * GET /api/support/all
 * Admin: all tickets with optional filters.
 * Agent: only tickets assigned to them.
 */
router.get('/all', protect, isAdminOrAgent, async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    // Agents only see their own assigned tickets
    if (req.user.isSupportAgent && !req.user.isAdmin) {
      query.assignedTo = req.user._id;
    }

    const tickets = await SupportTicket.find(query)
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await SupportTicket.countDocuments(query);

    res.json({ success: true, tickets, total });
  } catch (error) {
    console.error('[Support] Get all tickets error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PATCH /api/support/status
 * Update ticket status. Admin can update any; agent only their assigned tickets.
 * Body: { ticketId, status }
 */
router.patch('/status', protect, isAdminOrAgent, async (req, res) => {
  try {
    const { ticketId, status } = req.body;
    const allowedStatuses = ['open', 'pending', 'in-progress', 'closed'];
    if (!ticketId || !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'ticketId and a valid status are required' });
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (req.user.isSupportAgent && !req.user.isAdmin) {
      if (!ticket.assignedTo || String(ticket.assignedTo) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this ticket' });
      }
    }

    ticket.status = status;
    if (status === 'closed') {
      ticket.resolvedAt = new Date();
      ticket.resolvedBy = req.user._id;
      await pushToUser(ticket.userId, '✅ Ticket Resolved', `Your ticket "${ticket.subject}" has been closed.`, {
        screen: 'Support',
        ticketId: ticket._id.toString(),
      });
    }
    await ticket.save();

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('[Support] Update status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PATCH /api/support/assign
 * Assign or un-assign a ticket to/from a support agent. Admin only.
 * Body: { ticketId, agentId }  — agentId = null to un-assign
 */
router.patch('/assign', protect, isAdmin, async (req, res) => {
  try {
    const { ticketId, agentId } = req.body;
    if (!ticketId) return res.status(400).json({ success: false, message: 'ticketId is required' });

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (agentId) {
      const agent = await User.findById(agentId).select('name isSupportAgent isAdmin');
      if (!agent || (!agent.isSupportAgent && !agent.isAdmin)) {
        return res.status(400).json({ success: false, message: 'Target user is not a support agent or admin' });
      }
      ticket.assignedTo = agentId;
      ticket.assignedAt = new Date();
      if (ticket.status === 'open') ticket.status = 'in-progress';
      await pushToUser(agentId, '🎫 Ticket Assigned', `"${ticket.subject}" has been assigned to you.`, {
        screen: 'AdminSupport',
        ticketId: ticket._id.toString(),
      });
    } else {
      ticket.assignedTo = null;
      ticket.assignedAt = null;
    }

    await ticket.save();
    const populated = await SupportTicket.findById(ticket._id).populate('assignedTo', 'name email');
    res.json({ success: true, ticket: populated });
  } catch (error) {
    console.error('[Support] Assign error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/support/agents
 * List all staff users (admin + support agents) for the assignment dropdown.
 * Admin only.
 */
router.get('/agents', protect, isAdmin, async (req, res) => {
  try {
    const agents = await User.find({
      $or: [{ isSupportAgent: true }, { isAdmin: true }],
    }).select('name email isSupportAgent isAdmin');
    res.json({ success: true, agents });
  } catch (error) {
    console.error('[Support] Get agents error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Legacy compatibility routes (keep old paths alive) ───────────────────────

router.get('/my-tickets', protect, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(50);
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my-messages', protect, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(20);
    const messages = tickets.flatMap(t =>
      t.messages.map(m => ({
        id: m._id,
        ticketId: t._id,
        subject: t.subject,
        message: m.content,
        isFromAdmin: m.role === 'admin' || m.role === 'agent',
        adminName: m.senderName || m.adminName,
        createdAt: m.timestamp,
      }))
    );
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
