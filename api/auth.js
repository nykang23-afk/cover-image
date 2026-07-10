export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DB_ID = process.env.NOTION_DB_ID;
  const ADMIN_NUMBER = process.env.ADMIN_NUMBER || '1101';
  const ADMIN_PASSWORD_FALLBACK = process.env.ADMIN_PASSWORD || '1111';
  const ADMIN_ENTRY_TITLE = '__ADMIN__';

  // 도서 DB에서 __ADMIN__ 항목 조회
  async function getAdminEntry() {
    const r = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        filter: { property: '제목', title: { equals: ADMIN_ENTRY_TITLE } },
      }),
    });
    const data = await r.json();
    return data.results?.[0] || null;
  }

  async function getCurrentPassword() {
    try {
      const entry = await getAdminEntry();
      if (!entry) return ADMIN_PASSWORD_FALLBACK;
      return entry.properties['저자']?.rich_text?.[0]?.plain_text || ADMIN_PASSWORD_FALLBACK;
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

      const entry = await getAdminEntry();
      if (!entry) return res.status(500).json({ error: '관리자 설정을 찾을 수 없습니다.' });

      await fetch(`https://api.notion.com/v1/pages/${entry.id}`, {
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
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
