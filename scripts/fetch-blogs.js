// scripts/fetch-blogs.js
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml; q=0.9, */*; q=0.8',
  },
  timeout: 15000,
});

const feeds = [
  { name: '🎧 Spotify', url: 'https://engineering.atspotify.com/feed', tag: 'SPOTIFY-BLOG' },
  { name: '🎬 Netflix', url: 'https://netflixtechblog.com/feed', tag: 'NETFLIX-BLOG' },
  { name: '🏠 Airbnb', url: 'https://medium.com/feed/airbnb-engineering', tag: 'AIRBNB-BLOG' },
  { name: '📦 Dropbox', url: 'https://dropbox.tech/feed', tag: 'DROPBOX-BLOG' },
];

const MAX_POSTS = 2;

function cleanTitle(raw) {
  if (!raw) return 'Untitled';
  return raw
    .trim()
    .replace(/[\r\n]+/g, ' ')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')');
}

function formatDate(rawDate) {
  if (!rawDate) return '';
  const date = new Date(rawDate);
  if (isNaN(date.getTime())) return '';
  return (
    ' · ' +
    date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  );
}

async function fetchFeed({ name, url, tag }) {
  try {
    const feed = await parser.parseURL(url);
    if (!feed.items || feed.items.length === 0) {
      console.warn(`[WARN] No items found in feed for ${name}. Keeping existing content.`);
      return { tag, skip: true };
    }

    const posts = feed.items
      .slice(0, MAX_POSTS)
      .map(item => {
        const title = cleanTitle(item.title);
        const link = (item.link || item.guid || feed.link || '').trim();
        const dateStr = formatDate(item.pubDate || item.isoDate);

        return link ? `- **[${title}](${link})**${dateStr}` : `- **${title}**${dateStr}`;
      })
      .join('\n');

    return { tag, content: posts, skip: false };
  } catch (err) {
    console.warn(`[WARN] Failed to fetch ${name} (${url}): ${err.message}. Preserving previous content.`);
    return { tag, skip: true };
  }
}

async function updateReadme(sections) {
  const readmePath = path.join(process.cwd(), 'README.md');
  if (!fs.existsSync(readmePath)) {
    throw new Error(`README.md not found at ${readmePath}`);
  }

  let readme = fs.readFileSync(readmePath, 'utf-8');
  let updatedCount = 0;

  for (const section of sections) {
    if (!section || section.skip) continue;

    const { tag, content } = section;
    const startTag = `<!-- ${tag}:START -->`;
    const endTag = `<!-- ${tag}:END -->`;
    const regex = new RegExp(`${startTag}[\\s\\S]*?${endTag}`);

    if (regex.test(readme)) {
      readme = readme.replace(regex, `${startTag}\n\n${content.trim()}\n\n${endTag}`);
      updatedCount++;
    } else {
      console.warn(`[WARN] Tags ${startTag} / ${endTag} not found in README.md`);
    }
  }

  fs.writeFileSync(readmePath, readme, 'utf-8');
  console.log(`README updated successfully (${updatedCount} feed sections updated).`);
}

async function main() {
  console.log('Fetching engineering blog feeds...');
  const sections = await Promise.all(feeds.map(fetchFeed));
  await updateReadme(sections);
}

main().catch(err => {
  console.error('[ERROR] Fatal failure updating blogs:', err);
  process.exit(1);
});