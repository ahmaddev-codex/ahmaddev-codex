// scripts/fetch-blogs.js
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser();

const feeds = [
  { name: '🎧 Spotify', url: 'https://engineering.atspotify.com/feed/', tag: 'SPOTIFY-BLOG' },
  { name: '🎬 Netflix', url: 'https://netflixtechblog.com/feed/', tag: 'NETFLIX-BLOG' },
  { name: '🏠 Airbnb', url: 'https://medium.com/feed/airbnb-engineering', tag: 'AIRBNB-BLOG' },
  { name: '📦 Dropbox', url: 'https://dropbox.tech/feed', tag: 'DROPBOX-BLOG' },
];

const MAX_POSTS = 2;

async function fetchFeed({ name, url, tag }) {
  try {
    const feed = await parser.parseURL(url);
    const posts = feed.items.slice(0, MAX_POSTS).map(item => {
      const title = item.title?.trim() || 'Untitled';
      const link = item.link || item.guid || feed.link;
      const date = new Date(item.pubDate || item.isoDate);
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      
      // Fallback: if no link, just show title without link
      const display = link 
        ? `- **[${title}](${link})** · ${formattedDate}`
        : `- **${title}** · ${formattedDate}`;
      
      return display;
    }).join('\n');

    return { tag, content: `#### ${name}\n${posts}\n` };
  } catch (err) {
    console.error(`Failed to fetch ${name}:`, err.message);
    return { tag, content: `#### ${name}\n*Failed to load posts*\n` };
  }
}

async function updateReadme(sections) {
  const readmePath = path.join(process.cwd(), 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf-8');

  for (const { tag, content } of sections) {
    const startTag = `<!-- ${tag}:START -->`;
    const endTag = `<!-- ${tag}:END -->`;
    const regex = new RegExp(`${startTag}[\\s\\S]*?${endTag}`);
    
    if (regex.test(readme)) {
      readme = readme.replace(regex, `${startTag}\n${content}${endTag}`);
    } else {
      console.warn(`Tags ${startTag} not found in README.md`);
    }
  }

  fs.writeFileSync(readmePath, readme);
  console.log('README updated successfully');
}

async function main() {
  const sections = await Promise.all(feeds.map(fetchFeed));
  await updateReadme(sections);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});