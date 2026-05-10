const nodemailer = require('nodemailer');

function createTransport(settings) {
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port || 587,
    secure: settings.smtp_port === 465,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_password,
    },
  });
}

const baseStyle = `
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #1C1917;
`;

function friendRow(f) {
  const tierLabel = f.tier === 'best' ? 'Best Friend' : f.tier === 'good' ? 'Good Friend' : 'Casual Friend';
  return `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #E8E5DE;">
        <strong style="color: #1C1917;">${escapeHtml(f.name)}</strong>
        <span style="display:inline-block; margin-left:8px; font-size:11px; font-weight:600;
          padding:2px 7px; border-radius:99px; background:#EDE9FE; color:#6D28D9;
          text-transform:uppercase; letter-spacing:0.04em;">${tierLabel}</span>
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #E8E5DE; text-align:right; white-space:nowrap; color:#6B6660; font-size:14px;">
        ${f.status === 'overdue'
          ? `<span style="color:#991B1B; font-weight:600;">${Math.abs(f.days_remaining)} day${Math.abs(f.days_remaining) === 1 ? '' : 's'} overdue</span>`
          : `${f.days_remaining} day${f.days_remaining === 1 ? '' : 's'} left`
        }
      </td>
    </tr>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendTestEmail(settings) {
  const transporter = createTransport(settings);
  await transporter.sendMail({
    from: `"Frember" <${settings.smtp_user}>`,
    to: settings.email,
    subject: 'Frember — Test Email',
    html: `
      <div style="${baseStyle} max-width:480px; margin:0 auto; padding:40px 20px;">
        <h1 style="font-size:22px; font-weight:800; margin:0 0 8px;">Frember</h1>
        <p style="color:#6B6660; margin:0;">Your email notifications are configured correctly.</p>
      </div>`,
  });
}

async function sendReminderEmail(settings, friends) {
  const overdue = friends.filter(f => f.status === 'overdue');
  const soon = friends.filter(f => f.status === 'soon');
  if (overdue.length === 0 && soon.length === 0) return;

  const transporter = createTransport(settings);
  const total = overdue.length + soon.length;

  const overdueSection = overdue.length > 0 ? `
    <tr><td colspan="2" style="padding:20px 16px 8px;">
      <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#991B1B;">
        Overdue (${overdue.length})
      </span>
    </td></tr>
    ${overdue.map(friendRow).join('')}` : '';

  const soonSection = soon.length > 0 ? `
    <tr><td colspan="2" style="padding:20px 16px 8px;">
      <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#92400E;">
        Due Soon (${soon.length})
      </span>
    </td></tr>
    ${soon.map(friendRow).join('')}` : '';

  await transporter.sendMail({
    from: `"Frember" <${settings.smtp_user}>`,
    to: settings.email,
    subject: `Frember — ${total} friend${total === 1 ? '' : 's'} need${total === 1 ? 's' : ''} your attention`,
    html: `
      <div style="${baseStyle} background:#F6F4EF; padding:32px 16px;">
        <div style="max-width:480px; margin:0 auto; background:#fff;
          border-radius:14px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          <div style="padding:28px 28px 20px;">
            <h1 style="font-size:22px; font-weight:800; margin:0 0 4px; letter-spacing:-0.03em;">Frember</h1>
            <p style="color:#6B6660; margin:0; font-size:15px;">Here's who you should reach out to today.</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${overdueSection}
            ${soonSection}
          </table>
          <div style="padding:20px 28px; border-top:1px solid #E8E5DE;">
            <p style="font-size:12px; color:#A09A94; margin:0;">
              You're receiving this because notifications are enabled in Frember.
            </p>
          </div>
        </div>
      </div>`,
  });
}

module.exports = { sendTestEmail, sendReminderEmail };
