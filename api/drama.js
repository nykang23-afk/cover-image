export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DRAMA_DB_ID = 'b35c90f41d364a64a476ed9be63705bc';
  const headers = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  };

  try {
    // 목록 조회
    if (req.method === 'GET') {
      const r = await fetch(`https://api.notion.com/v1/databases/${DRAMA_DB_ID}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sorts: [{ timestamp: 'created_time', direction: 'descending' }],
          page_size: 100,
        }),
      });
      const data = await r.json();
      return res.status(200).json(data);
    }

    // 드라마 등록
    if (req.method === 'POST') {
      const { title, ott, thumbnail, cast, synopsis, status, genre } = req.body;
      const r = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          parent: { database_id: DRAMA_DB_ID },
          properties: {
            '제목': { title: [{ text: { content: title } }] },
            'OTT': { multi_select: (ott || []).map(o => ({ name: o })) },
            '썸네일': { rich_text: [{ text: { content: thumbnail || '' } }] },
            '출연진': { rich_text: [{ text: { content: cast || '' } }] },
            '줄거리': { rich_text: [{ text: { content: synopsis || '' } }] },
            '시청 여부': { status: { name: status || '시작 전' } },
            '장르': { multi_select: (genre || []).map(g => ({ name: g })) },
          },
        }),
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data });
      return res.status(200).json(data);
    }

    // 시청 여부 / 인생작 업데이트
    if (req.method === 'PATCH') {
      const { notionId, status, favorite } = req.body;
      const props = {};
      if (status !== undefined) props['시청 여부'] = { status: { name: status } };
      if (favorite !== undefined) props['인생작'] = { checkbox: favorite };
      const tryPatch = () => fetch(`https://api.notion.com/v1/pages/${notionId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ properties: props }),
      });
      let r = await tryPatch();
      if (!r.ok && favorite !== undefined) {
        await fetch(`https://api.notion.com/v1/databases/${DRAMA_DB_ID}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ properties: { '인생작': { checkbox: {} } } }),
        });
        r = await tryPatch();
      }
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data });
      return res.status(200).json({ success: true });
    }

    // 삭제 (archive)
    if (req.method === 'DELETE') {
      const { notionId } = req.body;
      const r = await fetch(`https://api.notion.com/v1/pages/${notionId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ archived: true }),
      });
      if (!r.ok) return res.status(r.status).json({ error: '삭제 실패' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
