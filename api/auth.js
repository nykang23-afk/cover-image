export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const SETTINGS_PAGE_ID = '399e5cada09e81a587a6f227ff75bdc6';
  const ADMIN_NUMBER = '1101';

  async function getCurrentPassword() {
    const r = await fetch(`https://api.notion.com/v1/blocks/${SETTINGS_PAGE_ID}/children`, {
      headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' },
    });
    const data = await r.json();
    for (const block of data.results || []) {
      const text = block.paragraph?.rich_text?.[0]?.plain_text || '';
      if (text.startsWith('비밀번호:')) return text.replace('비밀번호:', '').trim();
    }
    return '1111';
  }

  try {
    if (req.method === 'POST') {
      const { admin_number, password } = req.body;
      if (admin_number !== ADMIN_NUMBER)
        return res.status(401).json({ error: '관리자 번호가 올바르지 않습니다.' });
      const current = await getCurrentPassword();
      if (password !== current)
        return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'PUT') {
      const { admin_number, current_password, new_password } = req.body;
      if (admin_number !== ADMIN_NUMBER)
        return res.status(401).json({ error: '관리자 번호가 올바르지 않습니다.' });
      const current = await getCurrentPassword();
      if (current_password !== current)
        return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
      if (!new_password || new_password.length < 4)
        return res.status(400).json({ error: '새 비밀번호는 4자 이상이어야 합니다.' });

      // 비밀번호 블록 찾아서 업데이트
      const r = await fetch(`https://api.notion.com/v1/blocks/${SETTINGS_PAGE_ID}/children`, {
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' },
      });
      const data = await r.json();
      let pwBlockId = null;
      for (const block of data.results || []) {
        const text = block.paragraph?.rich_text?.[0]?.plain_text || '';
        if (text.startsWith('비밀번호:')) { pwBlockId = block.id; break; }
      }
      if (!pwBlockId) return res.status(500).json({ error: '설정 블록을 찾을 수 없습니다.' });

      await fetch(`https://api.notion.com/v1/blocks/${pwBlockId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
        body: JSON.stringify({ paragraph: { rich_text: [{ text: { content: `비밀번호: ${new_password}` } }] } }),
      });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
