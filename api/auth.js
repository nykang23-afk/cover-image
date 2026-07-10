export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const ADMIN_NUMBER = process.env.ADMIN_NUMBER || '1101';
  const ADMIN_PASSWORD_FALLBACK = process.env.ADMIN_PASSWORD || '1111';
  const ADMIN_PAGE_ID = '399e5cada09e8153aa6be15aba22feb6';

  async function getCurrentPassword() {
    try {
      const r = await fetch(`https://api.notion.com/v1/pages/${ADMIN_PAGE_ID}`, {
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' },
      });
      if (!r.ok) return ADMIN_PASSWORD_FALLBACK;
      const data = await r.json();
      return data.properties['저자']?.rich_text?.[0]?.plain_text || ADMIN_PASSWORD_FALLBACK;
    } catch (e) {
      return ADMIN_PASSWORD_FALLBACK;
    }
  }

  try {
    if (req.method === 'POST') {
      const { admin_number, password } = req.body;
      if (String(admin_number) !== String(ADMIN_NUMBER))
        return res.status(401).json({ error: '관리자 번호가 올바르지 않습니다.' });
      const current = await getCurrentPassword();
      if (String(password) !== String(current))
        return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'PUT') {
      const { admin_number, current_password, new_password } = req.body;
      if (String(admin_number) !== String(ADMIN_NUMBER))
        return res.status(401).json({ error: '관리자 번호가 올바르지 않습니다.' });
      const current = await getCurrentPassword();
      if (String(current_password) !== String(current))
        return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
      if (!new_password || String(new_password).length < 4)
        return res.status(400).json({ error: '새 비밀번호는 4자 이상이어야 합니다.' });

      const r = await fetch(`https://api.notion.com/v1/pages/${ADMIN_PAGE_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          properties: {
            '저자': { rich_text: [{ text: { content: String(new_password) } }] },
          },
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        return res.status(r.status).json({ error: err.message || '비밀번호 변경 실패' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
