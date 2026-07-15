export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DB_ID = process.env.NOTION_DB_ID;

  if (!NOTION_TOKEN || !NOTION_DB_ID) {
    return res.status(500).json({ error: '환경변수가 설정되지 않았습니다.' });
  }

  try {
    if (req.method === 'GET') {
      // 도서 목록 조회
      const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          sorts: [{ timestamp: 'created_time', direction: 'descending' }],
          page_size: 100,
        }),
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      // 도서 등록
      const { title, author, platform, status, genres, memo } = req.body;
      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { database_id: NOTION_DB_ID },
          properties: {
            '제목': { title: [{ text: { content: title } }] },
            '저자': { rich_text: [{ text: { content: author || '' } }] },
            '플랫폼': { select: { name: platform } },
            '완독 여부': { status: { name: status } },
            '장르': { multi_select: (genres || []).map(g => ({ name: g })) },
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data, status: response.status });
      }
      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      const { notionId, status, favorite } = req.body;
      if (!notionId) return res.status(400).json({ error: 'notionId가 필요합니다.' });
      const notionHeaders = {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      };
      const props = {};
      if (status !== undefined) props['완독 여부'] = { status: { name: status } };
      if (favorite !== undefined) props['인생작'] = { checkbox: favorite };
      const tryPatch = () => fetch(`https://api.notion.com/v1/pages/${notionId}`, {
        method: 'PATCH', headers: notionHeaders,
        body: JSON.stringify({ properties: props }),
      });
      let response = await tryPatch();
      if (!response.ok && favorite !== undefined) {
        await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}`, {
          method: 'PATCH', headers: notionHeaders,
          body: JSON.stringify({ properties: { '인생작': { checkbox: {} } } }),
        });
        response = await tryPatch();
      }
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { notionId } = req.body;
      if (!notionId) return res.status(400).json({ error: 'notionId가 필요합니다.' });
      const response = await fetch(`https://api.notion.com/v1/pages/${notionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({ archived: true }),
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
